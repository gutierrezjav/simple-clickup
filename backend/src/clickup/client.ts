import { ClickUpServiceError } from "./errors.js";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
    this.#timeoutMs = options.timeoutMs;
    this.#teamId = options.teamId;
  }

  async getListTasks(listId: string): Promise<ClickUpTaskPayload[]> {
    const tasks: ClickUpTaskPayload[] = [];

    for (let page = 0; page < 100; page += 1) {
      const payload = await this.#getJson(`/list/${listId}/task`, {
        archived: "false",
        include_closed: "true",
        include_timl: "true",
        page: String(page),
        subtasks: "true"
      });

      tasks.push(...parseTaskArray(payload));

      if (parseLastPage(payload) ?? parseTaskArray(payload).length === 0) {
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

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: this.#accessToken,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? 30_000;
        this.#rateLimitedUntil = Date.now() + retryAfterMs;
        throw new ClickUpServiceError(
          "ClickUp API rate limit reached.",
          429,
          retryAfterMs
        );
      }

      if (!response.ok) {
        throw new ClickUpServiceError(
          `ClickUp API request failed with status ${response.status}.`,
          502
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ClickUpServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ClickUpServiceError("ClickUp API request timed out.", 504);
      }

      throw new ClickUpServiceError("Failed to reach the ClickUp API.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}
