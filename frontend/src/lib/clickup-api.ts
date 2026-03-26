import type {
  DailyRow,
  StoryStatusDiscrepancyReport,
  VerificationSummary
} from "@custom-clickup/shared";

export interface DailyPageData {
  rows: DailyRow[];
}

export interface VerificationPageData {
  summary: VerificationSummary;
}

export interface StoryStatusDiscrepancyReportData {
  report: StoryStatusDiscrepancyReport;
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

async function fetchClickUpResource<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    throw new ClickUpApiError(
      errorPayload.message ?? "Failed to load data from the backend.",
      response.status,
      parseRetryAfterSeconds(response.headers.get("retry-after"))
    );
  }

  return (await response.json()) as T;
}

export function fetchDailyPageData(): Promise<DailyPageData> {
  return fetchClickUpResource<{ rows: DailyRow[] }>("/api/clickup/daily");
}

export function fetchVerificationPageData(): Promise<VerificationPageData> {
  return fetchClickUpResource<{ summary: VerificationSummary }>("/api/clickup/verification");
}

export function fetchStoryStatusDiscrepancyReportData(): Promise<StoryStatusDiscrepancyReportData> {
  return fetchClickUpResource<{ report: StoryStatusDiscrepancyReport }>(
    "/api/clickup/story-status-discrepancies"
  );
}

export function startClickUpOAuth(returnTo: string): void {
  const url = new URL("/auth/clickup/start", window.location.origin);
  url.searchParams.set("returnTo", returnTo);
  window.location.assign(url.toString());
}
