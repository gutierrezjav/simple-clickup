import type {
  DailyMeetingConfig,
  DailyRow,
  SprintPlanningReport,
  SprintPlanningRow,
  StoryStatusDiscrepancyReport,
  VerificationSummary
} from "@custom-clickup/shared";

export interface DailyPageData {
  dailyMeeting: DailyMeetingConfig;
  rows: DailyRow[];
}

export interface VerificationPageData {
  summary: VerificationSummary;
}

export interface PlanningPageData {
  report: SprintPlanningReport;
}

export interface PlanningTaskData {
  row: SprintPlanningRow;
}

export interface StoryStatusDiscrepancyReportData {
  report: StoryStatusDiscrepancyReport;
}

interface ApiErrorPayload {
  message?: string;
  rateLimit?: ClickUpApiRateLimit;
}

export interface ClickUpApiRateLimit {
  remaining: number;
  total: number;
  used: number;
}

export class ClickUpApiError extends Error {
  readonly rateLimit: ClickUpApiRateLimit | undefined;
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    status: number,
    retryAfterSeconds?: number,
    rateLimit?: ClickUpApiRateLimit
  ) {
    super(message);
    this.name = "ClickUpApiError";
    this.rateLimit = rateLimit;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function formatClickUpRateLimitUsage(error: Error): string | undefined {
  if (!(error instanceof ClickUpApiError) || !error.rateLimit) {
    return undefined;
  }

  return ` Request budget: ${error.rateLimit.used} / ${error.rateLimit.total} used.`;
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

async function requestClickUpResource<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    throw new ClickUpApiError(
      errorPayload.message ?? "Failed to load data from the backend.",
      response.status,
      parseRetryAfterSeconds(response.headers.get("retry-after")),
      errorPayload.rateLimit
    );
  }

  return (await response.json()) as T;
}

async function fetchClickUpResource<T>(path: string): Promise<T> {
  return requestClickUpResource<T>(path);
}

export function fetchDailyPageData(): Promise<DailyPageData> {
  return fetchClickUpResource<DailyPageData>("/api/clickup/daily");
}

export function fetchPlanningPageData(): Promise<PlanningPageData> {
  return fetchClickUpResource<PlanningPageData>("/api/clickup/planning");
}

export function fetchPlanningTask(taskId: string): Promise<PlanningTaskData> {
  return fetchClickUpResource<PlanningTaskData>(
    `/api/clickup/planning/tasks/${encodeURIComponent(taskId)}`
  );
}

export function updatePlanningTaskSprint(
  taskId: string,
  sprintLabel: string | null
): Promise<{ ok: true }> {
  return requestClickUpResource<{ ok: true }>(
    `/api/clickup/planning/tasks/${encodeURIComponent(taskId)}/sprint`,
    {
      body: JSON.stringify({ sprintLabel }),
      method: "PATCH"
    }
  );
}

export function updatePlanningTaskTime(
  taskId: string,
  body: {
    currentTrackedHours?: number;
    estimateHours?: number;
    trackedHours?: number;
  }
): Promise<{ ok: true }> {
  return requestClickUpResource<{ ok: true }>(
    `/api/clickup/planning/tasks/${encodeURIComponent(taskId)}/time`,
    {
      body: JSON.stringify(body),
      method: "PATCH"
    }
  );
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
