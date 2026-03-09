import { ClickUpServiceError } from "./errors.js";
import { resolveClickUpAuthorizationHeader } from "./token.js";
import type {
  ClickUpCustomTaskTypePayload,
  ClickUpFieldPayload,
  ClickUpTaskPayload
} from "./types.js";

interface ClickUpClientOptions {
  accessToken: string;
  baseUrl: string;
  timeoutMs: number;
  teamId: string;
}

const clickUpTaskFetchLimit = 500;
const maxClickUpTimeoutMs = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function logClickUp(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown>
): void {
  console[level](`[clickup] ${event}`, details);
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

export class ClickUpClient {
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #teamId: string;
  #rateLimitedUntil = 0;

  constructor(options: ClickUpClientOptions) {
    this.#accessToken = options.accessToken;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#timeoutMs = Math.min(options.timeoutMs, maxClickUpTimeoutMs);
    this.#teamId = options.teamId;
  }

  async getListTasks(listId: string): Promise<ClickUpTaskPayload[]> {
    const tasks: ClickUpTaskPayload[] = [];
    const startedAt = Date.now();

    logClickUp("info", "list-tasks:start", {
      listId,
      limit: clickUpTaskFetchLimit,
      timeoutMs: this.#timeoutMs
    });

    for (let page = 0; page < 100; page += 1) {
      const payload = await this.#getJson(`/list/${listId}/task`, {
        archived: "false",
        include_closed: "true",
        include_timl: "true",
        page: String(page),
        subtasks: "true"
      });
      const pageTasks = parseTaskArray(payload);
      const remainingSlots = clickUpTaskFetchLimit - tasks.length;

      if (remainingSlots > 0) {
        tasks.push(...pageTasks.slice(0, remainingSlots));
      }

      logClickUp("info", "list-tasks:page", {
        listId,
        page,
        fetched: pageTasks.length,
        total: tasks.length
      });

      if (tasks.length >= clickUpTaskFetchLimit) {
        logClickUp("warn", "list-tasks:limit-reached", {
          listId,
          limit: clickUpTaskFetchLimit,
          durationMs: Date.now() - startedAt
        });
        return tasks;
      }

      if (parseLastPage(payload) ?? pageTasks.length === 0) {
        logClickUp("info", "list-tasks:done", {
          listId,
          total: tasks.length,
          durationMs: Date.now() - startedAt
        });
        return tasks;
      }
    }

    logClickUp("error", "list-tasks:pagination-limit", {
      listId,
      total: tasks.length,
      pageLimit: 100,
      durationMs: Date.now() - startedAt
    });
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

  async #getJson(pathname: string, query?: Record<string, string>): Promise<unknown> {
    if (Date.now() < this.#rateLimitedUntil) {
      throw new ClickUpServiceError(
        "ClickUp API is temporarily rate-limited.",
        429,
        this.#rateLimitedUntil - Date.now()
      );
    }

    const url = new URL(`${this.#baseUrl}${pathname}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const startedAt = Date.now();

    logClickUp("info", "request:start", {
      pathname,
      query,
      timeoutMs: this.#timeoutMs
    });

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: resolveClickUpAuthorizationHeader(this.#accessToken),
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? 30_000;
        this.#rateLimitedUntil = Date.now() + retryAfterMs;
        logClickUp("warn", "request:rate-limited", {
          pathname,
          durationMs: Date.now() - startedAt,
          retryAfterMs
        });
        throw new ClickUpServiceError(
          "ClickUp API rate limit reached.",
          429,
          retryAfterMs
        );
      }

      if (!response.ok) {
        const statusCode =
          response.status === 401 || response.status === 403 ? 401 : 502;
        logClickUp("error", "request:failed", {
          pathname,
          durationMs: Date.now() - startedAt,
          responseStatus: response.status
        });
        throw new ClickUpServiceError(
          `ClickUp API request failed with status ${response.status}.`,
          statusCode
        );
      }

      logClickUp("info", "request:success", {
        pathname,
        durationMs: Date.now() - startedAt,
        responseStatus: response.status
      });
      return await response.json();
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        logClickUp("error", "request:timeout", {
          pathname,
          durationMs: Date.now() - startedAt,
          timeoutMs: this.#timeoutMs
        });
        throw new ClickUpServiceError("ClickUp API request timed out.", 504);
      }

      logClickUp("error", "request:network-error", {
        pathname,
        durationMs: Date.now() - startedAt
      });
      throw new ClickUpServiceError("Failed to reach the ClickUp API.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}
