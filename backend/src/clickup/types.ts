import type { DailyRow, SchemaConfig } from "@custom-clickup/shared";

export type ClickUpTokenSource = "env" | "session" | "none";

export interface ClickUpStatusPayload {
  status?: string | null;
}

export interface ClickUpUserPayload {
  username?: string | null;
  email?: string | null;
  profilePicture?: string | null;
}

export interface ClickUpTagPayload {
  name?: string | null;
}

export interface ClickUpCustomFieldOptionPayload {
  id?: string | number | null;
  name?: string | null;
  orderindex?: string | number | null;
}

export interface ClickUpCustomFieldPayload {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  required?: boolean;
  value?: unknown;
  type_config?: {
    options?: ClickUpCustomFieldOptionPayload[];
  };
}

export interface ClickUpTaskPayload {
  id?: string | null;
  custom_id?: string | null;
  custom_item_id?: number | null;
  name?: string | null;
  orderindex?: string | null;
  parent?: string | null;
  status?: ClickUpStatusPayload | string | null;
  assignees?: ClickUpUserPayload[];
  tags?: ClickUpTagPayload[];
  custom_fields?: ClickUpCustomFieldPayload[];
  subtasks?: ClickUpTaskPayload[];
}

export interface ClickUpFieldPayload {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  required?: boolean;
  type_config?: {
    options?: ClickUpCustomFieldOptionPayload[];
  };
}

export interface ClickUpCustomTaskTypePayload {
  id?: number | string | null;
  name?: string | null;
}

export interface ClickUpTaskQueryOptions {
  archived?: boolean;
  includeClosed?: boolean;
  includeTiml?: boolean;
  pageLimit?: number;
  statuses?: string[];
  subtasks?: boolean;
}

export interface ClickUpWorkspacePlan {
  planName: string | undefined;
  requestsPerMinute: number;
  source: "workspace-plan" | "fallback";
}

export interface ClickUpRateLimitState {
  limitPerMinute: number | undefined;
  planName: string | undefined;
  rateLimitedUntil: number;
  remainingInWindow: number | undefined;
  softLimitPerMinute: number | undefined;
  source: "workspace-plan" | "fallback" | undefined;
  upstreamLimit: number | undefined;
  upstreamRemaining: number | undefined;
  upstreamResetAt: number | undefined;
}

export interface ClickUpRequestSummary {
  cacheHit?: boolean;
  clickupRequestCount?: number;
  durationMs: number;
  httpStatus?: number;
  itemCount?: number;
  method: string;
  page?: number;
  pathname: string;
  readTarget?: "daily" | "story-status-discrepancies";
  responseItems?: number;
  startedAt: string;
  tokenSource?: ClickUpTokenSource;
  url?: string;
}

export interface ClickUpLiveSnapshot {
  schema: SchemaConfig;
  daily: DailyRow[];
}
