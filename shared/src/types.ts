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

export interface DailyMeetingConfig {
  excludedAssignees: string[];
  finalSpeaker?: string;
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

export interface SprintPlanningTotals {
  estimateHours: number;
  trackedHours: number;
  remainingHours: number;
  remainingDays: number;
  missingEstimateCount: number;
  rowCount: number;
}

export interface SprintPlanningSprintSummary extends SprintPlanningTotals {
  label: string;
  sprintColor?: string;
  weekNumber?: number;
}

export interface SprintPlanningSprintOption {
  color?: string;
  label: string;
}

export interface SprintPlanningAssignee {
  name: string;
  avatarUrl?: string;
}

export interface SprintPlanningRow {
  taskId: string;
  taskCustomId: string;
  title: string;
  taskType: string;
  epic?: string;
  epicColor?: string;
  status: string;
  statusColor?: string;
  assignees: SprintPlanningAssignee[];
  budget?: string;
  budgetColor?: string;
  sprintLabel: string;
  sprintColor?: string;
  sprintWeekNumber?: number;
  prioScore?: number;
  url?: string;
  estimateHours: number;
  trackedHours: number;
  remainingHours: number;
  remainingDays: number;
  rolledSubtaskCount: number;
  missingEstimate: boolean;
}

export interface SprintPlanningReport {
  viewId: string;
  dayHours: number;
  totals: SprintPlanningTotals;
  sprints: SprintPlanningSprintSummary[];
  sprintOptions: SprintPlanningSprintOption[];
  rows: SprintPlanningRow[];
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
