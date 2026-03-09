import type { DailyRow, PlanningItem, WriteMode } from "@custom-clickup/shared";

export type ReadMode = "mock" | "live";

export interface ResourceMetadata {
  readMode: ReadMode;
  writeMode: WriteMode;
}

export interface PlanningPageData extends ResourceMetadata {
  items: PlanningItem[];
}

export interface DailyPageData extends ResourceMetadata {
  rows: DailyRow[];
}

interface ApiErrorPayload {
  message?: string;
}

export class ClickUpApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "ClickUpApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseReadMode(headerValue: string | null): ReadMode {
  return headerValue === "live" ? "live" : "mock";
}

function parseRetryAfterSeconds(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const parsed = Number(headerValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

async function fetchClickUpResource<T extends { writeMode: WriteMode }>(
  path: string
): Promise<T & { readMode: ReadMode }> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json"
    }
  });

  const readMode = parseReadMode(response.headers.get("x-custom-clickup-read-mode"));

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    throw new ClickUpApiError(
      errorPayload.message ?? "Failed to load data from the backend.",
      response.status,
      parseRetryAfterSeconds(response.headers.get("retry-after"))
    );
  }

  const payload = (await response.json()) as T;
  return {
    ...payload,
    readMode
  };
}

export function fetchPlanningPageData(): Promise<PlanningPageData> {
  return fetchClickUpResource<{ items: PlanningItem[]; writeMode: WriteMode }>(
    "/api/clickup/planning"
  );
}

export function fetchDailyPageData(): Promise<DailyPageData> {
  return fetchClickUpResource<{ rows: DailyRow[]; writeMode: WriteMode }>(
    "/api/clickup/daily"
  );
}

export function startClickUpOAuth(returnTo: string): void {
  const url = new URL("/auth/clickup/start", window.location.origin);
  url.searchParams.set("returnTo", returnTo);
  window.location.assign(url.toString());
}
