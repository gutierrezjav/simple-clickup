export const dailyStatuses = [
  "BLOCKED",
  "SPRINT BACKLOG",
  "IN PROGRESS",
  "IN CODE REVIEW",
  "DEPLOYED TO DEV",
  "TESTED IN DEV",
  "DEPLOYED TO STAGING",
  "TESTED IN STAGING"
] as const;

export type DailyStatus = (typeof dailyStatuses)[number];

export const storyStatusProgression = [
  "SPRINT BACKLOG",
  "IN PROGRESS",
  "IN CODE REVIEW",
  "DEPLOYED TO DEV",
  "TESTED IN DEV",
  "DEPLOYED TO STAGING",
  "TESTED IN STAGING"
] as const;

export type StoryProgressStatus = (typeof storyStatusProgression)[number];

export interface DailyCard {
  id: string;
  customId: string;
  title: string;
  status: DailyStatus;
  prioScore?: number;
  assignee?: string;
  assigneeAvatarUrl?: string;
}

export interface DailyRow {
  id: string;
  title: string;
  type: "story" | "tasks" | "bugs";
  prioScore?: number;
  assignee?: string;
  assigneeAvatarUrl?: string;
  cards: DailyCard[];
}

export interface NamedCountSummary {
  name: string;
  count: number;
}

export interface StoryStatusDiscrepancy {
  storyId: string;
  storyCustomId: string;
  storyTitle: string;
  storyAssignee?: string;
  storyAssigneeAvatarUrl?: string;
  actualStatus: string;
  expectedStatus: StoryProgressStatus;
  activeChildCount: number;
  activeChildStatuses: NamedCountSummary[];
}

export interface StoryStatusDiscrepancyReport {
  checkedStoryCount: number;
  discrepancyCount: number;
  discrepancies: StoryStatusDiscrepancy[];
}

export interface VerificationSummary {
  schema: {
    workspaceId: string;
    listId: string;
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
