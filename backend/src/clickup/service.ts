import {
  dailyStatuses,
  storyStatusProgression,
  type DailyCard,
  type DailyRow,
  type SprintPlanningReport,
  type SprintPlanningRow,
  type SprintPlanningSprintOption,
  type SprintPlanningSprintSummary,
  type SprintPlanningTotals,
  type StoryProgressStatus,
  type StoryStatusDiscrepancyReport
} from "@custom-clickup/shared";
import { clickupLogger } from "../logging.js";
import { ClickUpClient } from "./client.js";
import { ClickUpServiceError } from "./errors.js";
import type {
  ClickUpCustomFieldPayload,
  ClickUpCustomFieldOptionPayload,
  ClickUpCustomTaskTypePayload,
  ClickUpStatusPayload,
  ClickUpTaskPayload,
  ClickUpTaskQueryOptions,
  ClickUpTokenSource,
  ClickUpUserPayload
} from "./types.js";

export interface ClickUpReadServiceConfig {
  accessToken: string | undefined;
  baseUrl: string;
  cacheTtlMs: number;
  listId: string;
  planningViewId: string;
  teamId: string;
  timeoutMs: number;
  tokenSource: ClickUpTokenSource;
}

interface AsyncCacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface CachedLoadResult<T> {
  cacheHit: boolean;
  value: T;
}

interface ClickUpTaskMetadataSnapshot {
  taskTypeMap: Map<number, string>;
}

export interface SprintPlanningReportMetadata {
  dayHours?: number;
  listCustomFields: ClickUpCustomFieldPayload[];
  viewId: string;
}

export interface SprintPlanningTimeUpdate {
  currentTrackedHours?: number;
  estimateHours?: number;
  trackedHours?: number;
}

type TaskKind = "story" | "standalone-task" | "standalone-bug" | "subtask";
type ReadTarget = "daily" | "story-status-discrepancies" | "planning" | "planning-task";
const defaultSprintPlanningDayHours = 8;
const hourMs = 60 * 60 * 1000;
const unassignedSprintLabel = "Unassigned Sprint";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const metadataCacheTtlMultiplier = 5;
const listCustomFieldsCacheTtlMs = 60 * 60 * 1000;
const storyStatusProgressionSet = new Set<string>(storyStatusProgression);

const dailyTaskQuery: ClickUpTaskQueryOptions = {
  archived: false,
  includeClosed: false,
  includeTiml: false,
  statuses: [...dailyStatuses],
  subtasks: true
};

const storyStatusCheckTaskQuery: ClickUpTaskQueryOptions = {
  archived: false,
  includeClosed: false,
  includeTiml: false,
  subtasks: true
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStatus(status: ClickUpStatusPayload | string | null | undefined): string {
  if (typeof status === "string") {
    return status.trim().toUpperCase();
  }

  return status?.status?.trim().toUpperCase() ?? "UNKNOWN";
}

function statusColor(status: ClickUpStatusPayload | string | null | undefined): string | undefined {
  return typeof status === "object" && status ? status.color?.trim() || undefined : undefined;
}

function firstAssignee(assignees: ClickUpUserPayload[] | undefined): ClickUpUserPayload | undefined {
  return assignees?.[0];
}

function assigneeName(assignee: ClickUpUserPayload | undefined): string | undefined {
  return assignee?.username?.trim() || assignee?.email?.trim() || undefined;
}

function assigneeAvatarUrl(assignee: ClickUpUserPayload | undefined): string | undefined {
  return assignee?.profilePicture?.trim() || undefined;
}

function parseOrderIndex(value: string | null | undefined): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function compareByTaskMetrics(
  left: { prioScore: number | undefined; orderindex: string | null | undefined },
  right: { prioScore: number | undefined; orderindex: string | null | undefined }
): number {
  const scoreDelta =
    (left.prioScore ?? Number.POSITIVE_INFINITY) - (right.prioScore ?? Number.POSITIVE_INFINITY);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return parseOrderIndex(left.orderindex) - parseOrderIndex(right.orderindex);
}

function parseNumberField(field: ClickUpCustomFieldPayload | undefined): number | undefined {
  const rawValue = field?.value;

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string" && rawValue.trim() !== "") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function flattenTasks(tasks: ClickUpTaskPayload[]): ClickUpTaskPayload[] {
  const deduped = new Map<string, ClickUpTaskPayload>();

  const visit = (task: ClickUpTaskPayload) => {
    const taskId = task.id?.trim();
    if (!taskId) {
      return;
    }

    deduped.set(taskId, { ...task, id: taskId });

    for (const subtask of task.subtasks ?? []) {
      visit(subtask);
    }
  };

  for (const task of tasks) {
    visit(task);
  }

  return [...deduped.values()];
}

function getCustomField(task: ClickUpTaskPayload, fieldName: string): ClickUpCustomFieldPayload | undefined {
  return task.custom_fields?.find((field) => field.name === fieldName);
}

function buildTaskTypeMap(taskTypes: ClickUpCustomTaskTypePayload[]): Map<number, string> {
  const taskTypeMap = new Map<number, string>();

  for (const taskType of taskTypes) {
    const id =
      typeof taskType.id === "number"
        ? taskType.id
        : typeof taskType.id === "string"
          ? Number(taskType.id)
          : Number.NaN;
    const name = taskType.name?.trim();

    if (!Number.isFinite(id) || !name) {
      continue;
    }

    taskTypeMap.set(id, name);
  }

  return taskTypeMap;
}

function classifyTask(
  task: ClickUpTaskPayload,
  taskTypeMap: Map<number, string>
): TaskKind {
  const normalizedTaskTypeName = normalizeName(taskTypeMap.get(task.custom_item_id ?? Number.NaN) ?? "");
  const hasPriorityBugTag = (task.tags ?? []).some((tag) => {
    const tagName = tag.name?.trim().toLowerCase();
    return tagName === "po prio" || tagName === "qa prio";
  });

  if (normalizedTaskTypeName.includes("story")) {
    return "story";
  }

  if (normalizedTaskTypeName.includes("bug") || hasPriorityBugTag) {
    return task.parent ? "subtask" : "standalone-bug";
  }

  return task.parent ? "subtask" : "standalone-task";
}

function toDailyCard(task: ClickUpTaskPayload): DailyCard {
  const primaryAssignee = firstAssignee(task.assignees);
  const assignee = assigneeName(primaryAssignee);
  const primaryAssigneeAvatarUrl = assignee ? assigneeAvatarUrl(primaryAssignee) : undefined;
  const prioScore = parseNumberField(getCustomField(task, "Prio score"));

  return {
    id: task.id ?? "unknown-task",
    customId: task.custom_id ?? task.id ?? "unknown-task",
    title: task.name?.trim() || "Untitled ClickUp task",
    status: normalizeStatus(task.status) as DailyCard["status"],
    ...(prioScore !== undefined ? { prioScore } : {}),
    ...(assignee ? { assignee } : {}),
    ...(primaryAssigneeAvatarUrl ? { assigneeAvatarUrl: primaryAssigneeAvatarUrl } : {})
  };
}

export function buildDailyRows(
  tasks: ClickUpTaskPayload[],
  taskTypeMap: Map<number, string>
): DailyRow[] {
  const flatTasks = flattenTasks(tasks);
  const taskById = new Map<string, ClickUpTaskPayload>();
  const childIdsByParentId = new Map<string, string[]>();
  const taskKindById = new Map<string, TaskKind>();
  const allowedStatuses = new Set<string>(dailyStatuses);

  for (const task of flatTasks) {
    const taskId = task.id;
    if (!taskId) {
      continue;
    }

    taskById.set(taskId, task);

    if (!task.parent) {
      continue;
    }

    const currentChildren = childIdsByParentId.get(task.parent) ?? [];
    currentChildren.push(taskId);
    childIdsByParentId.set(task.parent, currentChildren);
  }

  for (const task of flatTasks) {
    const taskId = task.id;
    if (!taskId) {
      continue;
    }

    taskKindById.set(taskId, classifyTask(task, taskTypeMap));
  }

  const rowIdByTaskId = new Map<string, string | undefined>();
  const getRowIdForTask = (taskId: string): string | undefined => {
    if (rowIdByTaskId.has(taskId)) {
      return rowIdByTaskId.get(taskId);
    }

    const kind = taskKindById.get(taskId);
    if (kind === "story") {
      rowIdByTaskId.set(taskId, undefined);
      return undefined;
    }

    const task = taskById.get(taskId);
    if (!task) {
      rowIdByTaskId.set(taskId, undefined);
      return undefined;
    }

    let rowId: string | undefined;

    if (!task.parent) {
      rowId = kind === "standalone-bug" ? "bugs-row" : "tasks-row";
    } else if (taskKindById.get(task.parent) === "story") {
      rowId = task.parent;
    } else {
      // Non-story descendants stay in the same swimlane as their parent task.
      rowId = getRowIdForTask(task.parent);
    }

    rowIdByTaskId.set(taskId, rowId);
    return rowId;
  };

  const cardsByRowId = new Map<
    string,
    Array<{ card: DailyCard; orderindex: string | null | undefined; prioScore: number | undefined }>
  >();

  for (const task of flatTasks) {
    const taskId = task.id;
    if (!taskId) {
      continue;
    }

    const kind = taskKindById.get(taskId);
    if (kind === "story" || !allowedStatuses.has(normalizeStatus(task.status))) {
      continue;
    }

    const rowId = getRowIdForTask(taskId);
    if (!rowId) {
      continue;
    }

    const currentCards = cardsByRowId.get(rowId) ?? [];
    currentCards.push({
      card: toDailyCard(task),
      orderindex: task.orderindex,
      prioScore: parseNumberField(getCustomField(task, "Prio score"))
    });
    cardsByRowId.set(rowId, currentCards);
  }

  const storyRows = flatTasks
    .map((task) => ({
      kind: taskKindById.get(task.id ?? ""),
      task
    }))
    .filter((entry) => entry.kind === "story")
    .map((entry) => {
      const primaryAssignee = firstAssignee(entry.task.assignees);
      const assignee = assigneeName(primaryAssignee);
      const primaryAssigneeAvatarUrl = assignee ? assigneeAvatarUrl(primaryAssignee) : undefined;
      const prioScore = parseNumberField(getCustomField(entry.task, "Prio score"));
      const cards = (cardsByRowId.get(entry.task.id ?? "") ?? [])
        .sort(compareByTaskMetrics)
        .map((entry) => entry.card);

      return {
        row: {
          id: entry.task.id ?? "unknown-story",
          title: entry.task.name?.trim() || "Untitled story",
          type: "story" as const,
          ...(prioScore !== undefined ? { prioScore } : {}),
          ...(assignee ? { assignee } : {}),
          ...(primaryAssigneeAvatarUrl ? { assigneeAvatarUrl: primaryAssigneeAvatarUrl } : {}),
          cards
        },
        prioScore,
        orderindex: entry.task.orderindex
      };
    })
    .sort(compareByTaskMetrics)
    .map((entry) => entry.row);

  const tasksRow: DailyRow = {
    id: "tasks-row",
    title: "Tasks",
    type: "tasks",
    cards: (cardsByRowId.get("tasks-row") ?? [])
      .sort(compareByTaskMetrics)
      .map((entry) => entry.card)
  };

  const bugsRow: DailyRow = {
    id: "bugs-row",
    title: "Bugs",
    type: "bugs",
    cards: (cardsByRowId.get("bugs-row") ?? [])
      .sort(compareByTaskMetrics)
      .map((entry) => entry.card)
  };

  return [...storyRows, tasksRow, bugsRow];
}

function getExpectedStoryStatus(statuses: StoryProgressStatus[]): StoryProgressStatus | undefined {
  const statusIndexes = statuses
    .map((status) => storyStatusProgression.indexOf(status))
    .filter((index) => index !== -1);

  if (statusIndexes.length === 0) {
    return undefined;
  }

  for (let threshold = storyStatusProgression.length - 1; threshold >= 1; threshold -= 1) {
    if (statusIndexes.every((index) => index >= threshold)) {
      return storyStatusProgression[threshold];
    }
  }

  if (statusIndexes.some((index) => index >= 1)) {
    return "IN PROGRESS";
  }

  return "SPRINT BACKLOG";
}

function countStoryProgressStatuses(statuses: StoryProgressStatus[]) {
  const counts = new Map<StoryProgressStatus, number>();

  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return storyStatusProgression
    .map((status) => ({
      name: status,
      count: counts.get(status) ?? 0
    }))
    .filter((entry) => entry.count > 0);
}

export function buildStoryStatusDiscrepancyReport(
  tasks: ClickUpTaskPayload[],
  taskTypeMap: Map<number, string>
): StoryStatusDiscrepancyReport {
  const flatTasks = flattenTasks(tasks);
  const taskById = new Map<string, ClickUpTaskPayload>();
  const taskKindById = new Map<string, TaskKind>();

  for (const task of flatTasks) {
    const taskId = task.id;
    if (!taskId) {
      continue;
    }

    taskById.set(taskId, task);
    taskKindById.set(taskId, classifyTask(task, taskTypeMap));
  }

  const storyIdByTaskId = new Map<string, string | undefined>();
  const getAncestorStoryId = (taskId: string): string | undefined => {
    if (storyIdByTaskId.has(taskId)) {
      return storyIdByTaskId.get(taskId);
    }

    const task = taskById.get(taskId);
    if (!task?.parent) {
      storyIdByTaskId.set(taskId, undefined);
      return undefined;
    }

    let storyId: string | undefined;
    if (taskKindById.get(task.parent) === "story") {
      storyId = task.parent;
    } else if (taskById.has(task.parent)) {
      storyId = getAncestorStoryId(task.parent);
    }

    storyIdByTaskId.set(taskId, storyId);
    return storyId;
  };

  const activeChildrenByStoryId = new Map<string, ClickUpTaskPayload[]>();

  for (const task of flatTasks) {
    const taskId = task.id;
    if (!taskId) {
      continue;
    }

    if (taskKindById.get(taskId) === "story") {
      continue;
    }

    const normalizedStatus = normalizeStatus(task.status);
    if (!storyStatusProgressionSet.has(normalizedStatus)) {
      continue;
    }

    const storyId = getAncestorStoryId(taskId);
    if (!storyId) {
      continue;
    }

    const currentChildren = activeChildrenByStoryId.get(storyId) ?? [];
    currentChildren.push(task);
    activeChildrenByStoryId.set(storyId, currentChildren);
  }

  const discrepancies = [...activeChildrenByStoryId.entries()]
    .flatMap(([storyId, activeChildren]) => {
      const story = taskById.get(storyId);
      if (!story) {
        return [];
      }

      const primaryAssignee = firstAssignee(story.assignees);
      const storyAssignee = assigneeName(primaryAssignee);
      const storyAssigneeAvatarUrl = storyAssignee
        ? assigneeAvatarUrl(primaryAssignee)
        : undefined;
      const childStatuses = activeChildren.map(
        (task) => normalizeStatus(task.status) as StoryProgressStatus
      );
      const expectedStatus = getExpectedStoryStatus(childStatuses);
      if (!expectedStatus) {
        return [];
      }

      const actualStatus = normalizeStatus(story.status);
      if (actualStatus === expectedStatus) {
        return [];
      }

      return [
        {
          discrepancy: {
            storyId,
            storyCustomId: story.custom_id ?? story.id ?? "unknown-story",
            storyTitle: story.name?.trim() || "Untitled story",
            ...(storyAssignee ? { storyAssignee } : {}),
            ...(storyAssigneeAvatarUrl ? { storyAssigneeAvatarUrl } : {}),
            actualStatus,
            expectedStatus,
            activeChildCount: activeChildren.length,
            activeChildStatuses: countStoryProgressStatuses(childStatuses)
          },
          orderindex: story.orderindex,
          prioScore: parseNumberField(getCustomField(story, "Prio score"))
        }
      ];
    })
    .sort(compareByTaskMetrics)
    .map((entry) => entry.discrepancy);

  return {
    checkedStoryCount: activeChildrenByStoryId.size,
    discrepancyCount: discrepancies.length,
    discrepancies
  };
}

function parseMilliseconds(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function hasTimeEstimate(task: ClickUpTaskPayload): boolean {
  const value = task.time_estimate;

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value));
  }

  return false;
}

function toHours(milliseconds: number): number {
  return milliseconds / 3_600_000;
}

function parseSprintWeekNumber(label: string): number | undefined {
  const match = /^W\s*(\d+)/i.exec(label.trim());
  if (!match) {
    return undefined;
  }

  const weekNumber = Number(match[1]);
  return Number.isSafeInteger(weekNumber) ? weekNumber : undefined;
}

function getStringCandidate(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  return undefined;
}

function getListCustomField(
  field: ClickUpCustomFieldPayload | undefined,
  listCustomFields: ClickUpCustomFieldPayload[],
  fieldName: string
): ClickUpCustomFieldPayload | undefined {
  return (
    (field?.id
      ? listCustomFields.find((customField) => customField.id === field.id)
      : undefined) ??
    listCustomFields.find((customField) => customField.name === fieldName)
  );
}

interface DropdownOptionDisplayValue {
  color?: string;
  value: string;
}

function getDropdownOptionLabel(option: ClickUpCustomFieldOptionPayload): string | undefined {
  return option.name?.trim() || option.label?.trim() || undefined;
}

function getDropdownOptionColor(option: ClickUpCustomFieldOptionPayload): string | undefined {
  return option.color?.trim() || undefined;
}

function resolveDropdownOption(
  rawValue: unknown,
  fields: Array<ClickUpCustomFieldPayload | undefined>
): DropdownOptionDisplayValue | undefined {
  const options = fields.flatMap((field) => field?.type_config?.options ?? []);

  if (isRecord(rawValue)) {
    const directName =
      getStringCandidate(rawValue.name) ??
      getStringCandidate(rawValue.label);
    if (directName) {
      const matchedOption = options.find((option) => getDropdownOptionLabel(option) === directName);
      const color = matchedOption ? getDropdownOptionColor(matchedOption) : undefined;

      return {
        value: directName,
        ...(color ? { color } : {})
      };
    }

    return (
      resolveDropdownOption(rawValue.value, fields) ??
      resolveDropdownOption(rawValue.id, fields) ??
      resolveDropdownOption(rawValue.option_id, fields) ??
      resolveDropdownOption(rawValue.optionId, fields) ??
      resolveDropdownOption(rawValue.orderindex, fields) ??
      resolveDropdownOption(rawValue.orderIndex, fields)
    );
  }

  const rawValueString =
    typeof rawValue === "string" || typeof rawValue === "number"
      ? String(rawValue)
      : undefined;

  if (!rawValueString) {
    return undefined;
  }

  const matchedOption = options.find((option) => {
    const optionId = option.id === undefined || option.id === null ? undefined : String(option.id);
    const optionOrderindex =
      option.orderindex === undefined || option.orderindex === null
        ? undefined
        : String(option.orderindex);
    const optionLabel = getDropdownOptionLabel(option);

    return (
      optionId === rawValueString ||
      optionOrderindex === rawValueString ||
      optionLabel === rawValueString
    );
  });

  if (!matchedOption) {
    const fallbackValue = getStringCandidate(rawValue);
    return fallbackValue ? { value: fallbackValue } : undefined;
  }

  const value = getDropdownOptionLabel(matchedOption);
  const color = getDropdownOptionColor(matchedOption);

  return value
    ? {
        value,
        ...(color ? { color } : {})
      }
    : undefined;
}

function resolveDropdownOptionName(
  rawValue: unknown,
  fields: Array<ClickUpCustomFieldPayload | undefined>
): string | undefined {
  return resolveDropdownOption(rawValue, fields)?.value;
}

function resolveCustomFieldDisplayValue(
  rawValue: unknown,
  fields: Array<ClickUpCustomFieldPayload | undefined>
): string | undefined {
  if (Array.isArray(rawValue)) {
    const values = rawValue
      .map((value) => resolveCustomFieldDisplayValue(value, fields))
      .filter((value): value is string => Boolean(value));

    return values.length > 0 ? values.join(", ") : undefined;
  }

  const dropdownOptionName = resolveDropdownOptionName(rawValue, fields);
  if (dropdownOptionName) {
    return dropdownOptionName;
  }

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return String(rawValue);
  }

  if (typeof rawValue === "boolean") {
    return rawValue ? "Yes" : "No";
  }

  if (!isRecord(rawValue)) {
    return undefined;
  }

  const directValue =
    getStringCandidate(rawValue.text) ??
    getStringCandidate(rawValue.title) ??
    getStringCandidate(rawValue.username) ??
    getStringCandidate(rawValue.email);
  if (directValue) {
    return directValue;
  }

  return (
    resolveCustomFieldDisplayValue(rawValue.value, fields) ??
    resolveCustomFieldDisplayValue(rawValue.values, fields) ??
    resolveCustomFieldDisplayValue(rawValue.items, fields)
  );
}

function getPlanningCustomFieldDisplayValue(
  task: ClickUpTaskPayload,
  listCustomFields: ClickUpCustomFieldPayload[],
  fieldName: string
): string | undefined {
  const field = getCustomField(task, fieldName);
  if (!field) {
    return undefined;
  }

  return resolveCustomFieldDisplayValue(
    field.value,
    [field, getListCustomField(field, listCustomFields, fieldName)]
  );
}

function getPlanningDropdownFieldDisplayValue(
  task: ClickUpTaskPayload,
  listCustomFields: ClickUpCustomFieldPayload[],
  fieldName: string
): DropdownOptionDisplayValue | undefined {
  const field = getCustomField(task, fieldName);
  if (!field) {
    return undefined;
  }

  const fields = [field, getListCustomField(field, listCustomFields, fieldName)];
  const dropdownOption = resolveDropdownOption(field.value, fields);
  if (dropdownOption) {
    return dropdownOption;
  }

  const value = resolveCustomFieldDisplayValue(field.value, fields);
  return value ? { value } : undefined;
}

function resolveSprintDisplayValue(
  task: ClickUpTaskPayload,
  listCustomFields: ClickUpCustomFieldPayload[]
): DropdownOptionDisplayValue | undefined {
  return getPlanningDropdownFieldDisplayValue(task, listCustomFields, "Sprint");
}

function getSprintCustomField(
  listCustomFields: ClickUpCustomFieldPayload[]
): ClickUpCustomFieldPayload | undefined {
  return listCustomFields.find((field) => field.name === "Sprint");
}

function getSprintPlanningOptions(
  listCustomFields: ClickUpCustomFieldPayload[]
): SprintPlanningSprintOption[] {
  return (getSprintCustomField(listCustomFields)?.type_config?.options ?? [])
    .map((option) => {
      const label = getDropdownOptionLabel(option);
      const color = getDropdownOptionColor(option);

      return label
        ? {
            label,
            ...(color ? { color } : {})
          }
        : undefined;
    })
    .filter((option): option is SprintPlanningSprintOption => Boolean(option));
}

function resolveSprintOptionId(
  listCustomFields: ClickUpCustomFieldPayload[],
  sprintLabel: string
): string | undefined {
  const sprintField = getSprintCustomField(listCustomFields);
  const option = sprintField?.type_config?.options?.find(
    (candidate) => getDropdownOptionLabel(candidate) === sprintLabel
  );

  return option?.id === undefined || option.id === null ? undefined : String(option.id);
}

function resolveSprintLabel(
  task: ClickUpTaskPayload,
  listCustomFields: ClickUpCustomFieldPayload[]
): string {
  return resolveExplicitSprintLabel(task, listCustomFields) ?? unassignedSprintLabel;
}

function resolveExplicitSprintLabel(
  task: ClickUpTaskPayload,
  listCustomFields: ClickUpCustomFieldPayload[]
): string | undefined {
  return resolveSprintDisplayValue(task, listCustomFields)?.value;
}

function getTaskTypeName(
  task: ClickUpTaskPayload,
  taskTypeMap: Map<number, string>
): string {
  return taskTypeMap.get(task.custom_item_id ?? Number.NaN)?.trim() || "Task";
}

function getTaskAssignees(task: ClickUpTaskPayload): SprintPlanningRow["assignees"] {
  return (task.assignees ?? [])
    .map((assignee) => {
      const name = assigneeName(assignee);
      const avatarUrl = assigneeAvatarUrl(assignee);

      if (!name) {
        return undefined;
      }

      return {
        name,
        ...(avatarUrl ? { avatarUrl } : {})
      };
    })
    .filter((assignee): assignee is SprintPlanningRow["assignees"][number] => Boolean(assignee));
}

function compareOptionalNumbers(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }

  if (left === undefined) {
    return 1;
  }

  if (right === undefined) {
    return -1;
  }

  return left - right;
}

function compareSprintLabels(
  left: { sprintLabel: string; sprintWeekNumber?: number },
  right: { sprintLabel: string; sprintWeekNumber?: number }
): number {
  const weekDelta = compareOptionalNumbers(left.sprintWeekNumber, right.sprintWeekNumber);
  if (weekDelta !== 0) {
    return weekDelta;
  }

  return left.sprintLabel.localeCompare(right.sprintLabel);
}

function createEmptySprintPlanningTotals(): SprintPlanningTotals {
  return {
    estimateHours: 0,
    trackedHours: 0,
    remainingHours: 0,
    remainingDays: 0,
    missingEstimateCount: 0,
    rowCount: 0
  };
}

function addRowToSprintPlanningTotals(
  totals: SprintPlanningTotals,
  row: SprintPlanningRow
): void {
  totals.estimateHours += row.estimateHours;
  totals.trackedHours += row.trackedHours;
  totals.remainingHours += row.remainingHours;
  totals.remainingDays += row.remainingDays;
  totals.missingEstimateCount += row.missingEstimate ? 1 : 0;
  totals.rowCount += 1;
}

interface SprintPlanningTaskGraph {
  childIdsByParentId: Map<string, string[]>;
  flatTasks: ClickUpTaskPayload[];
  taskById: Map<string, ClickUpTaskPayload>;
}

function buildSprintPlanningTaskGraph(tasks: ClickUpTaskPayload[]): SprintPlanningTaskGraph {
  const flatTasks = flattenTasks(tasks);
  const childIdsByParentId = new Map<string, string[]>();
  const taskById = new Map<string, ClickUpTaskPayload>();

  for (const task of flatTasks) {
    const taskId = task.id;
    if (!taskId) {
      continue;
    }

    taskById.set(taskId, task);

    if (!task.parent) {
      continue;
    }

    const currentChildIds = childIdsByParentId.get(task.parent) ?? [];
    currentChildIds.push(taskId);
    childIdsByParentId.set(task.parent, currentChildIds);
  }

  return {
    childIdsByParentId,
    flatTasks,
    taskById
  };
}

function isSamePlanningSprintLabel(left: string, right: string): boolean {
  const leftWeekNumber = parseSprintWeekNumber(left);
  const rightWeekNumber = parseSprintWeekNumber(right);

  if (leftWeekNumber !== undefined && rightWeekNumber !== undefined) {
    return leftWeekNumber === rightWeekNumber;
  }

  return left === right;
}

function isExplicitlyAssignedToDifferentSprint(
  task: ClickUpTaskPayload,
  parentSprintLabel: string,
  listCustomFields: ClickUpCustomFieldPayload[]
): boolean {
  const taskSprintLabel = resolveExplicitSprintLabel(task, listCustomFields);

  return (
    taskSprintLabel !== undefined &&
    !isSamePlanningSprintLabel(taskSprintLabel, parentSprintLabel)
  );
}

function getVisiblePlanningRowTasks(
  graph: SprintPlanningTaskGraph,
  listCustomFields: ClickUpCustomFieldPayload[]
): ClickUpTaskPayload[] {
  const visibleTaskIds = new Set(graph.flatTasks.map((task) => task.id).filter(Boolean));

  return graph.flatTasks.filter((task) => {
    if (!task.id) {
      return false;
    }

    if (!task.parent || !visibleTaskIds.has(task.parent)) {
      return true;
    }

    const parentTask = graph.taskById.get(task.parent);
    if (!parentTask) {
      return true;
    }

    return isExplicitlyAssignedToDifferentSprint(
      task,
      resolveSprintLabel(parentTask, listCustomFields),
      listCustomFields
    );
  });
}

function collectPlanningTaskRollup(
  task: ClickUpTaskPayload,
  graph: SprintPlanningTaskGraph,
  listCustomFields: ClickUpCustomFieldPayload[]
): ClickUpTaskPayload[] {
  const rolledTasks = new Map<string, ClickUpTaskPayload>();
  const rootSprintLabel = resolveSprintLabel(task, listCustomFields);

  const visit = (currentTask: ClickUpTaskPayload) => {
    const currentTaskId = currentTask.id;
    if (!currentTaskId || rolledTasks.has(currentTaskId)) {
      return;
    }

    rolledTasks.set(currentTaskId, currentTask);

    for (const subtask of currentTask.subtasks ?? []) {
      if (!isExplicitlyAssignedToDifferentSprint(subtask, rootSprintLabel, listCustomFields)) {
        visit(subtask);
      }
    }

    for (const childId of graph.childIdsByParentId.get(currentTaskId) ?? []) {
      const childTask = graph.taskById.get(childId);
      if (
        childTask &&
        !isExplicitlyAssignedToDifferentSprint(childTask, rootSprintLabel, listCustomFields)
      ) {
        visit(childTask);
      }
    }
  };

  visit(task);
  return [...rolledTasks.values()];
}

function toSprintPlanningRow(
  task: ClickUpTaskPayload,
  rolledTasks: ClickUpTaskPayload[],
  taskTypeMap: Map<number, string>,
  metadata: Required<SprintPlanningReportMetadata>
): {
  orderindex: string | null | undefined;
  row: SprintPlanningRow;
} {
  const estimateMs = rolledTasks.reduce(
    (total, rolledTask) => total + parseMilliseconds(rolledTask.time_estimate),
    0
  );
  const trackedMs = rolledTasks.reduce(
    (total, rolledTask) => total + parseMilliseconds(rolledTask.time_spent),
    0
  );
  const remainingMs = estimateMs - trackedMs;
  const sprint = resolveSprintDisplayValue(task, metadata.listCustomFields);
  const sprintLabel = sprint?.value ?? unassignedSprintLabel;
  const sprintWeekNumber = parseSprintWeekNumber(sprintLabel);
  const prioScore = parseNumberField(getCustomField(task, "Prio score"));
  const epic = getPlanningDropdownFieldDisplayValue(task, metadata.listCustomFields, "Epic");
  const budget = getPlanningDropdownFieldDisplayValue(task, metadata.listCustomFields, "Budget");
  const taskStatusColor = statusColor(task.status);
  const estimateHours = toHours(estimateMs);
  const trackedHours = toHours(trackedMs);
  const remainingHours = toHours(remainingMs);
  const taskId = task.id ?? "unknown-task";

  const row: SprintPlanningRow = {
    taskId,
    taskCustomId: task.custom_id ?? taskId,
    title: task.name?.trim() || "Untitled ClickUp task",
    taskType: getTaskTypeName(task, taskTypeMap),
    ...(epic ? { epic: epic.value } : {}),
    ...(epic?.color ? { epicColor: epic.color } : {}),
    status: normalizeStatus(task.status),
    ...(taskStatusColor ? { statusColor: taskStatusColor } : {}),
    assignees: getTaskAssignees(task),
    ...(budget ? { budget: budget.value } : {}),
    ...(budget?.color ? { budgetColor: budget.color } : {}),
    sprintLabel,
    ...(sprint?.color ? { sprintColor: sprint.color } : {}),
    ...(sprintWeekNumber !== undefined ? { sprintWeekNumber } : {}),
    ...(prioScore !== undefined ? { prioScore } : {}),
    ...(task.url?.trim() ? { url: task.url.trim() } : {}),
    estimateHours,
    trackedHours,
    remainingHours,
    remainingDays: remainingHours / metadata.dayHours,
    rolledSubtaskCount: Math.max(0, rolledTasks.length - 1),
    missingEstimate: !rolledTasks.some(hasTimeEstimate)
  };

  return {
    orderindex: task.orderindex,
    row
  };
}

function compareSprintPlanningRows(
  left: { orderindex: string | null | undefined; row: SprintPlanningRow },
  right: { orderindex: string | null | undefined; row: SprintPlanningRow }
): number {
  const sprintDelta = compareSprintLabels(left.row, right.row);
  if (sprintDelta !== 0) {
    return sprintDelta;
  }

  const prioDelta = compareOptionalNumbers(left.row.prioScore, right.row.prioScore);
  if (prioDelta !== 0) {
    return prioDelta;
  }

  const orderDelta = parseOrderIndex(left.orderindex) - parseOrderIndex(right.orderindex);
  if (orderDelta !== 0) {
    return orderDelta;
  }

  const customIdDelta = left.row.taskCustomId.localeCompare(right.row.taskCustomId);
  if (customIdDelta !== 0) {
    return customIdDelta;
  }

  return left.row.title.localeCompare(right.row.title);
}

function buildSprintPlanningSprintSummaries(
  rows: SprintPlanningRow[]
): SprintPlanningSprintSummary[] {
  const totalsByLabel = new Map<string, SprintPlanningSprintSummary>();

  for (const row of rows) {
    const existing = totalsByLabel.get(row.sprintLabel);
    const summary =
      existing ??
      ({
        label: row.sprintLabel,
        ...(row.sprintColor ? { sprintColor: row.sprintColor } : {}),
        ...(row.sprintWeekNumber !== undefined ? { weekNumber: row.sprintWeekNumber } : {}),
        ...createEmptySprintPlanningTotals()
      } satisfies SprintPlanningSprintSummary);

    addRowToSprintPlanningTotals(summary, row);
    if (!summary.sprintColor && row.sprintColor) {
      summary.sprintColor = row.sprintColor;
    }
    totalsByLabel.set(row.sprintLabel, summary);
  }

  return [...totalsByLabel.values()].sort((left, right) =>
    compareSprintLabels(
      {
        sprintLabel: left.label,
        ...(left.weekNumber !== undefined ? { sprintWeekNumber: left.weekNumber } : {})
      },
      {
        sprintLabel: right.label,
        ...(right.weekNumber !== undefined ? { sprintWeekNumber: right.weekNumber } : {})
      }
    )
  );
}

export function buildSprintPlanningReport(
  tasks: ClickUpTaskPayload[],
  taskTypeMap: Map<number, string>,
  metadata: SprintPlanningReportMetadata
): SprintPlanningReport {
  const resolvedMetadata: Required<SprintPlanningReportMetadata> = {
    dayHours: metadata.dayHours ?? defaultSprintPlanningDayHours,
    listCustomFields: metadata.listCustomFields,
    viewId: metadata.viewId
  };
  const graph = buildSprintPlanningTaskGraph(tasks);
  const rowEntries = getVisiblePlanningRowTasks(graph, resolvedMetadata.listCustomFields)
    .map((task) =>
      toSprintPlanningRow(
        task,
        collectPlanningTaskRollup(task, graph, resolvedMetadata.listCustomFields),
        taskTypeMap,
        resolvedMetadata
      )
    )
    .sort(compareSprintPlanningRows);
  const rows = rowEntries.map((entry) => entry.row);
  const totals = createEmptySprintPlanningTotals();

  for (const row of rows) {
    addRowToSprintPlanningTotals(totals, row);
  }

  return {
    viewId: resolvedMetadata.viewId,
    dayHours: resolvedMetadata.dayHours,
    totals,
    sprints: buildSprintPlanningSprintSummaries(rows),
    sprintOptions: getSprintPlanningOptions(resolvedMetadata.listCustomFields),
    rows
  };
}

function createCachedLoader<T>(
  cacheTtlMs: number,
  load: () => Promise<T>
): (() => Promise<CachedLoadResult<T>>) & { clear: () => void } {
  let cachedEntry: AsyncCacheEntry<T> | undefined;
  let inflight: Promise<T> | undefined;

  const loadCached = async (): Promise<CachedLoadResult<T>> => {
    const now = Date.now();
    if (cachedEntry && cachedEntry.expiresAt > now) {
      return {
        cacheHit: true,
        value: cachedEntry.value
      };
    }

    if (!inflight) {
      inflight = (async () => {
        const value = await load();
        cachedEntry = {
          expiresAt: Date.now() + cacheTtlMs,
          value
        };
        return value;
      })();
    }

    try {
      return {
        cacheHit: false,
        value: await inflight
      };
    } finally {
      inflight = undefined;
    }
  };

  loadCached.clear = () => {
    cachedEntry = undefined;
    inflight = undefined;
  };

  return loadCached;
}

export interface ClickUpReadService {
  getDailyRows(): Promise<DailyRow[]>;
  getSprintPlanningReport(): Promise<SprintPlanningReport>;
  getSprintPlanningTask(taskId: string): Promise<SprintPlanningRow>;
  getStoryStatusDiscrepancyReport(): Promise<StoryStatusDiscrepancyReport>;
  updateSprintPlanningTaskSprint(taskId: string, sprintLabel: string | null): Promise<void>;
  updateSprintPlanningTaskTime(taskId: string, update: SprintPlanningTimeUpdate): Promise<void>;
}

export function createClickUpReadService(config: ClickUpReadServiceConfig): ClickUpReadService {
  if (!config.accessToken) {
    throw new ClickUpServiceError(
      "Connect ClickUp to continue.",
      401
    );
  }

  const client = new ClickUpClient({
    accessToken: config.accessToken,
    baseUrl: config.baseUrl,
    teamId: config.teamId,
    timeoutMs: config.timeoutMs,
    tokenSource: config.tokenSource
  });

  const logger = clickupLogger.child({
    component: "clickup-read-service",
    list_id: config.listId,
    token_source: config.tokenSource
  });
  const metadataCacheTtlMs = Math.max(config.cacheTtlMs * metadataCacheTtlMultiplier, config.cacheTtlMs);

  const loadTaskMetadata = createCachedLoader(
    metadataCacheTtlMs,
    async (): Promise<ClickUpTaskMetadataSnapshot> => {
      const taskTypes = await client.getCustomTaskTypes();

      return {
        taskTypeMap: buildTaskTypeMap(taskTypes)
      };
    }
  );
  const loadListCustomFields = createCachedLoader(
    listCustomFieldsCacheTtlMs,
    () => client.getListCustomFields(config.listId)
  );

  const loadDaily = createCachedLoader(config.cacheTtlMs, async (): Promise<DailyRow[]> => {
    const [metadata, tasks] = await Promise.all([
      loadTaskMetadata(),
      client.getListTasks(config.listId, dailyTaskQuery)
    ]);

    return buildDailyRows(tasks, metadata.value.taskTypeMap);
  });

  const loadSprintPlanning = createCachedLoader(
    config.cacheTtlMs,
    async (): Promise<SprintPlanningReport> => {
      const [metadata, listCustomFields] = await Promise.all([
        loadTaskMetadata(),
        loadListCustomFields()
      ]);
      const planningTasks = await client.getViewTasks(config.planningViewId);

      return buildSprintPlanningReport(
        planningTasks,
        metadata.value.taskTypeMap,
        {
          dayHours: defaultSprintPlanningDayHours,
          listCustomFields: listCustomFields.value,
          viewId: config.planningViewId
        }
      );
    }
  );

  const loadStoryStatusDiscrepancies = createCachedLoader(
    config.cacheTtlMs,
    async (): Promise<StoryStatusDiscrepancyReport> => {
      const [metadata, tasks] = await Promise.all([
        loadTaskMetadata(),
        client.getListTasks(config.listId, storyStatusCheckTaskQuery)
      ]);

      return buildStoryStatusDiscrepancyReport(tasks, metadata.value.taskTypeMap);
    }
  );

  const runLogicalRead = async <T>(
    readTarget: ReadTarget,
    load: () => Promise<CachedLoadResult<T>>,
    getItemCount: (value: T) => number
  ): Promise<T> => {
    const startedAt = Date.now();
    const beforeCount = client.getRequestCountSnapshot();

    try {
      const result = await load();
      const value = result.value;

      logger.info(
        {
          cache_hit: result.cacheHit,
          clickup_request_count: client.getRequestCountSnapshot() - beforeCount,
          duration_ms: Date.now() - startedAt,
          event: "read:complete",
          item_count: getItemCount(value),
          rate_limit: client.getRateLimitState(),
          read_target: readTarget
        },
        "ClickUp logical read completed."
      );

      return value;
    } catch (error) {
      logger.error(
        {
          clickup_request_count: client.getRequestCountSnapshot() - beforeCount,
          duration_ms: Date.now() - startedAt,
          err: error,
          event: "read:failed",
          rate_limit: client.getRateLimitState(),
          read_target: readTarget
        },
        "ClickUp logical read failed."
      );

      throw error;
    }
  };

  const getSprintPlanningTask = async (taskId: string): Promise<SprintPlanningRow> => {
    return runLogicalRead(
      "planning-task",
      async () => {
        const [metadata, listCustomFields, task] = await Promise.all([
          loadTaskMetadata(),
          loadListCustomFields(),
          client.getTask(taskId, { subtasks: true })
        ]);
        const report = buildSprintPlanningReport(
          [task],
          metadata.value.taskTypeMap,
          {
            dayHours: defaultSprintPlanningDayHours,
            listCustomFields: listCustomFields.value,
            viewId: config.planningViewId
          }
        );
        const row = report.rows[0];

        if (!row) {
          throw new ClickUpServiceError("Planning task could not be converted to a row.", 502);
        }

        return {
          cacheHit: false,
          value: row
        };
      },
      () => 1
    );
  };

  const updateSprintPlanningTaskTime = async (
    taskId: string,
    update: SprintPlanningTimeUpdate
  ): Promise<void> => {
    const hasEstimateUpdate = typeof update.estimateHours === "number";
    const hasTrackedUpdate = typeof update.trackedHours === "number";

    if (!hasEstimateUpdate && !hasTrackedUpdate) {
      throw new ClickUpServiceError("No planning time changes were provided.", 400);
    }

    if (hasEstimateUpdate) {
      const estimateHours = update.estimateHours;
      if (estimateHours === undefined || !Number.isFinite(estimateHours) || estimateHours < 0) {
        throw new ClickUpServiceError("Estimate must be a positive number of hours.", 400);
      }

      const [metadata, listCustomFields, task] = await Promise.all([
        loadTaskMetadata(),
        loadListCustomFields(),
        client.getTask(taskId, { subtasks: true })
      ]);
      const report = buildSprintPlanningReport(
        [task],
        metadata.value.taskTypeMap,
        {
          dayHours: defaultSprintPlanningDayHours,
          listCustomFields: listCustomFields.value,
          viewId: config.planningViewId
        }
      );
      const row = report.rows[0];

      if (!row) {
        throw new ClickUpServiceError("Planning task could not be converted to a row.", 502);
      }

      const parentEstimateHours = toHours(parseMilliseconds(task.time_estimate));
      const rolledChildEstimateHours = Math.max(0, row.estimateHours - parentEstimateHours);
      const nextParentEstimateHours = estimateHours - rolledChildEstimateHours;

      if (nextParentEstimateHours < 0) {
        throw new ClickUpServiceError(
          "Estimate cannot be lower than rolled subtask estimates.",
          400
        );
      }

      await client.updateTask(taskId, {
        time_estimate: Math.round(nextParentEstimateHours * hourMs)
      });
    }

    if (hasTrackedUpdate) {
      const trackedHours = update.trackedHours;
      if (trackedHours === undefined || !Number.isFinite(trackedHours) || trackedHours < 0) {
        throw new ClickUpServiceError("Tracked time must be a positive number of hours.", 400);
      }

      const currentTrackedHours = update.currentTrackedHours ?? 0;
      if (!Number.isFinite(currentTrackedHours) || currentTrackedHours < 0) {
        throw new ClickUpServiceError("Current tracked time must be a positive number of hours.", 400);
      }

      const trackedDeltaHours = trackedHours - currentTrackedHours;
      if (trackedDeltaHours < 0) {
        throw new ClickUpServiceError(
          "Tracked time can only be increased from the planning view.",
          400
        );
      }

      if (trackedDeltaHours > 0) {
        await client.createTimeEntry(taskId, Math.round(trackedDeltaHours * hourMs));
      }
    }

    loadSprintPlanning.clear();
  };

  const updateSprintPlanningTaskSprint = async (
    taskId: string,
    sprintLabel: string | null
  ): Promise<void> => {
    const listCustomFields = await loadListCustomFields();
    const sprintField = getSprintCustomField(listCustomFields.value);

    if (!sprintField?.id) {
      throw new ClickUpServiceError("Sprint custom field is not available for this list.", 400);
    }

    if (sprintLabel === null || sprintLabel === unassignedSprintLabel) {
      await client.removeCustomFieldValue(taskId, sprintField.id);
      loadSprintPlanning.clear();
      return;
    }

    const sprintOptionId = resolveSprintOptionId(listCustomFields.value, sprintLabel);
    if (!sprintOptionId) {
      throw new ClickUpServiceError(`Unknown sprint option: ${sprintLabel}.`, 400);
    }

    const sprintValue =
      sprintField.type === "labels" ? [sprintOptionId] : sprintOptionId;

    await client.setCustomFieldValue(taskId, sprintField.id, sprintValue);
    loadSprintPlanning.clear();
  };

  return {
    async getDailyRows() {
      return runLogicalRead("daily", loadDaily, (rows) => rows.length);
    },
    async getSprintPlanningReport() {
      return runLogicalRead(
        "planning",
        loadSprintPlanning,
        (report) => report.rows.length
      );
    },
    getSprintPlanningTask,
    async getStoryStatusDiscrepancyReport() {
      return runLogicalRead(
        "story-status-discrepancies",
        loadStoryStatusDiscrepancies,
        (report) => report.discrepancyCount
      );
    },
    updateSprintPlanningTaskSprint,
    updateSprintPlanningTaskTime
  };
}
