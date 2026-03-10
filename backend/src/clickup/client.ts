import type { Logger } from "pino";
import { clickupLogger } from "../logging.js";
import { ClickUpServiceError } from "./errors.js";
import { resolveClickUpAuthorizationHeader } from "./token.js";
import type {
  ClickUpCustomTaskTypePayload,
  ClickUpFieldPayload,
  ClickUpRateLimitState,
  ClickUpTaskPayload,
  ClickUpTaskQueryOptions,
  ClickUpTokenSource,
  ClickUpWorkspacePlan
} from "./types.js";

interface ClickUpClientOptions {
  accessToken: string;
  baseUrl: string;
  teamId: string;
  timeoutMs: number;
  tokenSource: ClickUpTokenSource;
}

interface RequestOptions {
  page?: number;
  query?: Array<readonly [string, string]>;
  skipPlanLookup?: boolean;
}

const clickUpTaskFetchLimit = 500;
const defaultRequestsPerMinute = 100;
const localRateLimitRatio = 0.9;
const lowBudgetWarningRatio = 0.1;
const maxClickUpTimeoutMs = 10_000;
const maxPaginationPages = 100;
const rollingWindowMs = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMillis = Date.parse(headerValue);
  if (Number.isNaN(dateMillis)) {
    return undefined;
  }

  return Math.max(0, dateMillis - Date.now());
}

function parsePositiveInteger(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const parsed = Number(headerValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseResetAtMs(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const numericValue = Number(headerValue);
  if (Number.isFinite(numericValue)) {
    if (numericValue > 1_000_000_000_000) {
      return numericValue;
    }

    if (numericValue > 1_000_000_000) {
      return numericValue * 1000;
    }
  }

  const dateMillis = Date.parse(headerValue);
  if (Number.isNaN(dateMillis)) {
    return undefined;
  }

  return dateMillis;
}

function collectRecordsFromArrays(payload: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (isRecord(entry)) {
          records.push(entry);
        }
        visit(entry);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const nestedValue of Object.values(value)) {
      visit(nestedValue);
    }
  };

  visit(payload);

  return records;
}

function parseTaskArray(payload: unknown): ClickUpTaskPayload[] {
  if (isRecord(payload) && Array.isArray(payload.tasks)) {
    return payload.tasks as ClickUpTaskPayload[];
  }

  throw new ClickUpServiceError("Unexpected ClickUp tasks response shape.", 502);
}

function parseLastPage(payload: unknown): boolean | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (typeof payload.last_page === "boolean") {
    return payload.last_page;
  }

  return undefined;
}

function parseFields(payload: unknown): ClickUpFieldPayload[] {
  const candidates = collectRecordsFromArrays(payload).filter((record) => {
    return (
      typeof record.id === "string" &&
      typeof record.name === "string" &&
      typeof record.type === "string"
    );
  });

  if (candidates.length === 0) {
    throw new ClickUpServiceError("Unexpected ClickUp custom-fields response shape.", 502);
  }

  return candidates as ClickUpFieldPayload[];
}

function parseCustomTaskTypes(payload: unknown): ClickUpCustomTaskTypePayload[] {
  const candidates = collectRecordsFromArrays(payload).filter((record) => {
    return (
      (typeof record.id === "string" || typeof record.id === "number") &&
      typeof record.name === "string"
    );
  });

  if (candidates.length === 0) {
    throw new ClickUpServiceError("Unexpected ClickUp custom-task-types response shape.", 502);
  }

  return candidates as ClickUpCustomTaskTypePayload[];
}

function estimateResponseItems(payload: unknown): number | undefined {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  const directCandidates = [
    payload.tasks,
    payload.teams,
    payload.custom_items,
    payload.fields
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.length;
    }
  }

  const collected = collectRecordsFromArrays(payload);
  return collected.length > 0 ? collected.length : undefined;
}

function normalizePlanName(planName: string | undefined): string | undefined {
  return planName?.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function mapPlanNameToRequestsPerMinute(planName: string | undefined): number | undefined {
  const normalizedPlanName = normalizePlanName(planName);
  if (!normalizedPlanName) {
    return undefined;
  }

  if (normalizedPlanName.includes("enterprise")) {
    return 10_000;
  }

  if (normalizedPlanName.includes("business plus")) {
    return 1_000;
  }

  if (
    normalizedPlanName.includes("business") ||
    normalizedPlanName.includes("unlimited") ||
    normalizedPlanName.includes("free forever") ||
    normalizedPlanName === "free"
  ) {
    return 100;
  }

  return undefined;
}

function parseWorkspacePlanName(payload: unknown): string | undefined {
  const visit = (value: unknown): string | undefined => {
    if (typeof value === "string" && mapPlanNameToRequestsPerMinute(value) !== undefined) {
      return value;
    }

    if (!isRecord(value)) {
      return undefined;
    }

    const prioritizedKeys = ["plan", "current_plan", "name", "tier", "type"] as const;
    for (const key of prioritizedKeys) {
      const nestedValue = value[key];
      const parsed = visit(nestedValue);
      if (parsed) {
        return parsed;
      }
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (!/(plan|tier|type|name)/i.test(key)) {
        continue;
      }

      const parsed = visit(nestedValue);
      if (parsed) {
        return parsed;
      }
    }

    return undefined;
  };

  return visit(payload);
}

function buildListTaskQuery(page: number, options: ClickUpTaskQueryOptions): Array<readonly [string, string]> {
  const query: Array<readonly [string, string]> = [
    ["archived", String(options.archived ?? false)],
    ["include_closed", String(options.includeClosed ?? true)],
    ["include_timl", String(options.includeTiml ?? true)],
    ["page", String(page)],
    ["subtasks", String(options.subtasks ?? true)]
  ];

  for (const status of options.statuses ?? []) {
    query.push(["statuses[]", status]);
  }

  return query;
}

function createFallbackWorkspacePlan(): ClickUpWorkspacePlan {
  return {
    planName: undefined,
    requestsPerMinute: defaultRequestsPerMinute,
    source: "fallback"
  };
}

export class ClickUpClient {
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #logger: Logger;
  readonly #teamId: string;
  readonly #timeoutMs: number;
  #dispatchCount = 0;
  #lastLowBudgetWarningAt: number | undefined;
  #rateLimitedUntil = 0;
  #requestTimestamps: number[] = [];
  #upstreamLimit: number | undefined;
  #upstreamRemaining: number | undefined;
  #upstreamResetAt: number | undefined;
  #workspacePlan: ClickUpWorkspacePlan | undefined;
  #workspacePlanPromise: Promise<ClickUpWorkspacePlan> | undefined;

  constructor(options: ClickUpClientOptions) {
    this.#accessToken = options.accessToken;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#teamId = options.teamId;
    this.#timeoutMs = Math.min(options.timeoutMs, maxClickUpTimeoutMs);
    this.#logger = clickupLogger.child({
      team_id: options.teamId,
      token_source: options.tokenSource
    });
  }

  async getListTasks(
    listId: string,
    options: ClickUpTaskQueryOptions = {}
  ): Promise<ClickUpTaskPayload[]> {
    const tasks: ClickUpTaskPayload[] = [];
    const pageLimit = Math.min(options.pageLimit ?? maxPaginationPages, maxPaginationPages);

    for (let page = 0; page < pageLimit; page += 1) {
      const payload = await this.#getJson(`/list/${listId}/task`, {
        page,
        query: buildListTaskQuery(page, options)
      });
      const pageTasks = parseTaskArray(payload);
      const remainingSlots = clickUpTaskFetchLimit - tasks.length;

      if (remainingSlots > 0) {
        tasks.push(...pageTasks.slice(0, remainingSlots));
      }

      if (tasks.length >= clickUpTaskFetchLimit) {
        this.#logger.warn(
          {
            event: "request:task-limit-reached",
            fetched_tasks: tasks.length,
            limit: clickUpTaskFetchLimit,
            list_id: listId
          },
          "ClickUp task fetch reached the safety limit."
        );
        return tasks;
      }

      if (parseLastPage(payload) ?? pageTasks.length === 0) {
        return tasks;
      }
    }

    throw new ClickUpServiceError("ClickUp task pagination exceeded the safety limit.", 502);
  }

  async getListFields(listId: string): Promise<ClickUpFieldPayload[]> {
    const payload = await this.#getJson(`/list/${listId}/field`);
    return parseFields(payload);
  }

  async getCustomTaskTypes(): Promise<ClickUpCustomTaskTypePayload[]> {
    const payload = await this.#getJson(`/team/${this.#teamId}/custom_item`);
    return parseCustomTaskTypes(payload);
  }

  async getWorkspacePlan(): Promise<ClickUpWorkspacePlan> {
    if (this.#workspacePlan) {
      return this.#workspacePlan;
    }

    if (!this.#workspacePlanPromise) {
      this.#workspacePlanPromise = this.#loadWorkspacePlan();
    }

    try {
      this.#workspacePlan = await this.#workspacePlanPromise;
      return this.#workspacePlan;
    } finally {
      this.#workspacePlanPromise = undefined;
    }
  }

  getRequestCountSnapshot(): number {
    return this.#dispatchCount;
  }

  getRateLimitState(): ClickUpRateLimitState {
    return this.#createRateLimitStateSnapshot(Date.now());
  }

  async #loadWorkspacePlan(): Promise<ClickUpWorkspacePlan> {
    try {
      const payload = await this.#getJson(`/team/${this.#teamId}/plan`, {
        skipPlanLookup: true
      });
      const planName = parseWorkspacePlanName(payload);
      const requestsPerMinute = mapPlanNameToRequestsPerMinute(planName);

      if (!requestsPerMinute) {
        throw new Error("Unknown workspace plan.");
      }

      const workspacePlan: ClickUpWorkspacePlan = {
        planName,
        requestsPerMinute,
        source: "workspace-plan"
      };

      this.#logger.info(
        {
          event: "workspace-plan:resolved",
          plan_name: planName,
          requests_per_minute: requestsPerMinute
        },
        "Resolved ClickUp workspace plan."
      );

      return workspacePlan;
    } catch (error) {
      const fallbackPlan = createFallbackWorkspacePlan();

      this.#logger.warn(
        {
          err: error,
          event: "workspace-plan:fallback",
          requests_per_minute: fallbackPlan.requestsPerMinute
        },
        "Falling back to the conservative ClickUp request budget."
      );

      return fallbackPlan;
    }
  }

  async #getJson(pathname: string, options: RequestOptions = {}): Promise<unknown> {
    if (!options.skipPlanLookup) {
      await this.getWorkspacePlan();
    }

    return this.#dispatchJson("GET", pathname, options);
  }

  async #dispatchJson(method: string, pathname: string, options: RequestOptions): Promise<unknown> {
    const now = Date.now();
    this.#assertCanDispatch(now);

    const url = new URL(`${this.#baseUrl}${pathname}`);
    for (const [key, value] of options.query ?? []) {
      url.searchParams.append(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const startedAt = Date.now();
    const startedAtIso = new Date(startedAt).toISOString();

    this.#recordDispatch(startedAt);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: resolveClickUpAuthorizationHeader(this.#accessToken),
          "Content-Type": "application/json"
        },
        method,
        signal: controller.signal
      });

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      this.#updateRateLimitStateFromHeaders(response);

      if (response.status === 429) {
        const resetAt = this.#upstreamResetAt;
        const boundedRetryAfterMs =
          retryAfterMs ??
          (typeof resetAt === "number" ? Math.max(0, resetAt - Date.now()) : undefined) ??
          30_000;
        this.#rateLimitedUntil = Date.now() + boundedRetryAfterMs;

        this.#logger.warn(
          {
            event: "request:rate-limited",
            duration_ms: Date.now() - startedAt,
            http_status: response.status,
            method,
            page: options.page,
            pathname,
            rate_limit: this.#createRateLimitStateSnapshot(Date.now()),
            retry_after_ms: boundedRetryAfterMs,
            started_at: startedAtIso,
            url: `${url.pathname}${url.search}`
          },
          "ClickUp API rate limit reached."
        );

        throw new ClickUpServiceError(
          "ClickUp API rate limit reached.",
          429,
          boundedRetryAfterMs
        );
      }

      if (!response.ok) {
        const statusCode =
          response.status === 401 || response.status === 403 ? 401 : 502;

        this.#logger.error(
          {
            duration_ms: Date.now() - startedAt,
            event: "request:failed",
            http_status: response.status,
            method,
            page: options.page,
            pathname,
            started_at: startedAtIso,
            url: `${url.pathname}${url.search}`
          },
          "ClickUp API request failed."
        );

        throw new ClickUpServiceError(
          `ClickUp API request failed with status ${response.status}.`,
          statusCode
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ClickUpServiceError("ClickUp API returned invalid JSON.", 502);
      }

      this.#logger.info(
        {
          duration_ms: Date.now() - startedAt,
          event: "request:complete",
          http_status: response.status,
          method,
          page: options.page,
          pathname,
          rate_limit: this.#createRateLimitStateSnapshot(Date.now()),
          response_items: estimateResponseItems(payload),
          started_at: startedAtIso,
          url: `${url.pathname}${url.search}`
        },
        "ClickUp API request completed."
      );

      return payload;
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        this.#logger.error(
          {
            duration_ms: Date.now() - startedAt,
            event: "request:timeout",
            method,
            page: options.page,
            pathname,
            started_at: startedAtIso,
            timeout_ms: this.#timeoutMs,
            url: `${url.pathname}${url.search}`
          },
          "ClickUp API request timed out."
        );

        throw new ClickUpServiceError("ClickUp API request timed out.", 504);
      }

      this.#logger.error(
        {
          duration_ms: Date.now() - startedAt,
          err: error,
          event: "request:network-error",
          method,
          page: options.page,
          pathname,
          started_at: startedAtIso,
          url: `${url.pathname}${url.search}`
        },
        "Failed to reach the ClickUp API."
      );

      throw new ClickUpServiceError("Failed to reach the ClickUp API.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  #recordDispatch(timestamp: number): void {
    this.#pruneRequestWindow(timestamp);
    this.#requestTimestamps.push(timestamp);
    this.#dispatchCount += 1;
    this.#warnIfBudgetIsLow(timestamp);
  }

  #assertCanDispatch(now: number): void {
    this.#pruneRequestWindow(now);

    if (now < this.#rateLimitedUntil) {
      throw new ClickUpServiceError(
        "ClickUp API is temporarily rate-limited.",
        429,
        this.#rateLimitedUntil - now
      );
    }

    const softLimit = this.#getSoftLimitPerMinute();
    if (!softLimit) {
      return;
    }

    if (this.#requestTimestamps.length < softLimit) {
      return;
    }

    const oldestTimestamp = this.#requestTimestamps[0];
    if (typeof oldestTimestamp !== "number") {
      return;
    }
    const retryAfterMs = Math.max(1, rollingWindowMs - (now - oldestTimestamp));

    this.#logger.warn(
      {
        event: "request:locally-throttled",
        rate_limit: this.#createRateLimitStateSnapshot(now),
        retry_after_ms: retryAfterMs
      },
      "Blocking ClickUp request to avoid exhausting the local request budget."
    );

    throw new ClickUpServiceError(
      "ClickUp API request budget is temporarily exhausted.",
      429,
      retryAfterMs
    );
  }

  #warnIfBudgetIsLow(now: number): void {
    const softLimit = this.#getSoftLimitPerMinute();
    if (!softLimit) {
      return;
    }

    const remainingBudget = Math.max(0, softLimit - this.#requestTimestamps.length);
    const warningThreshold = Math.max(1, Math.ceil(softLimit * lowBudgetWarningRatio));
    if (remainingBudget > warningThreshold) {
      return;
    }

    const oldestTimestamp = this.#requestTimestamps[0] ?? now;
    if (this.#lastLowBudgetWarningAt === oldestTimestamp) {
      return;
    }

    this.#lastLowBudgetWarningAt = oldestTimestamp;

    this.#logger.warn(
      {
        event: "request:budget-low",
        rate_limit: this.#createRateLimitStateSnapshot(now)
      },
      "ClickUp request budget is running low."
    );
  }

  #pruneRequestWindow(now: number): void {
    while (this.#requestTimestamps.length > 0) {
      const oldestTimestamp = this.#requestTimestamps[0];
      if (typeof oldestTimestamp !== "number" || now - oldestTimestamp < rollingWindowMs) {
        break;
      }

      this.#requestTimestamps.shift();
    }
  }

  #getSoftLimitPerMinute(): number | undefined {
    if (!this.#workspacePlan?.requestsPerMinute) {
      return undefined;
    }

    return Math.max(1, Math.floor(this.#workspacePlan.requestsPerMinute * localRateLimitRatio));
  }

  #createRateLimitStateSnapshot(now: number): ClickUpRateLimitState {
    this.#pruneRequestWindow(now);

    const softLimitPerMinute = this.#getSoftLimitPerMinute();
    return {
      limitPerMinute: this.#workspacePlan?.requestsPerMinute,
      planName: this.#workspacePlan?.planName,
      rateLimitedUntil: this.#rateLimitedUntil,
      remainingInWindow:
        typeof softLimitPerMinute === "number"
          ? Math.max(0, softLimitPerMinute - this.#requestTimestamps.length)
          : undefined,
      softLimitPerMinute,
      source: this.#workspacePlan?.source,
      upstreamLimit: this.#upstreamLimit,
      upstreamRemaining: this.#upstreamRemaining,
      upstreamResetAt: this.#upstreamResetAt
    };
  }

  #updateRateLimitStateFromHeaders(response: Response): void {
    this.#upstreamLimit = parsePositiveInteger(response.headers.get("x-ratelimit-limit"));
    this.#upstreamRemaining = parsePositiveInteger(response.headers.get("x-ratelimit-remaining"));
    this.#upstreamResetAt = parseResetAtMs(response.headers.get("x-ratelimit-reset"));
  }
}
