import type { DailyRow, PlanningItem, SchemaConfig } from "@custom-clickup/shared";

export interface ClickUpStatusPayload {
  status?: string | null;
}

export interface ClickUpUserPayload {
  username?: string | null;
  email?: string | null;
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
}

export interface ClickUpCustomTaskTypePayload {
  id?: number | string | null;
  name?: string | null;
}

export interface ClickUpLiveSnapshot {
  schema: SchemaConfig;
  planning: PlanningItem[];
  daily: DailyRow[];
}
