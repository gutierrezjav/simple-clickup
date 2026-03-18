export type WriteMode = "mock" | "test-space" | "live";

export const planningExcludedStatuses = [
  "DEPLOYED TO DEV",
  "TESTED IN DEV",
  "DEPLOYED TO STAGING",
  "TESTED IN STAGING",
  "DEPLOYED TO PROD",
  "PROD MINOR ISSUE",
  "CLOSED"
] as const;

export const dailyStatuses = [
  "BLOCKED",
  "SPRINT BACKLOG",
  "IN PROGRESS",
  "IN CODE REVIEW",
  "DEPLOYED TO DEV",
  "TESTED IN DEV"
] as const;

export type DailyStatus = (typeof dailyStatuses)[number];

export type PlanningKind = "story" | "standalone-task" | "standalone-bug" | "subtask";

export interface PlanningItem {
  id: string;
  customId: string;
  title: string;
  kind: PlanningKind;
  status: string;
  prioScore?: number;
  assignee?: string;
  budget?: string;
  children?: PlanningItem[];
}

export interface DailyCard {
  id: string;
  customId: string;
  title: string;
  status: DailyStatus;
  prioScore?: number;
  assignee?: string;
}

export interface DailyRow {
  id: string;
  title: string;
  type: "story" | "tasks" | "bugs";
  prioScore?: number;
  cards: DailyCard[];
}

export interface NamedCountSummary {
  name: string;
  count: number;
}

export interface VerificationSummary {
  schema: {
    workspaceId: string;
    listId: string;
  };
  planning: {
    itemCount: number;
    childCount: number;
    missingAssigneeCount: number;
    missingBudgetCount: number;
    missingPrioScoreCount: number;
    byKind: NamedCountSummary[];
    byStatus: NamedCountSummary[];
  };
  daily: {
    rowCount: number;
    cardCount: number;
    storyRowCount: number;
    storyRowsWithoutCards: number;
    missingAssigneeCount: number;
    missingPrioScoreCount: number;
    byRowType: NamedCountSummary[];
    byStatus: NamedCountSummary[];
  };
}

export interface SchemaConfig {
  workspaceId: string;
  listId: string;
  planningExcludedStatuses: readonly string[];
  dailyStatuses: readonly DailyStatus[];
  inlineEditableFields: string[];
}
