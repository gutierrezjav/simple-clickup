import {
  dailyStatuses,
  storyStatusProgression,
  type DailyCard,
  type DailyRow,
  type StoryProgressStatus,
  type StoryStatusDiscrepancyReport
} from "@custom-clickup/shared";
import { clickupLogger } from "../logging.js";
import { ClickUpClient } from "./client.js";
import { ClickUpServiceError } from "./errors.js";
import type {
  ClickUpCustomFieldPayload,
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

type TaskKind = "story" | "standalone-task" | "standalone-bug" | "subtask";
type ReadTarget = "daily" | "story-status-discrepancies";

const metadataCacheTtlMultiplier = 5;
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

function createCachedLoader<T>(
  cacheTtlMs: number,
  load: () => Promise<T>
): () => Promise<CachedLoadResult<T>> {
  let cachedEntry: AsyncCacheEntry<T> | undefined;
  let inflight: Promise<T> | undefined;

  return async (): Promise<CachedLoadResult<T>> => {
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
}

export interface ClickUpReadService {
  getDailyRows(): Promise<DailyRow[]>;
  getStoryStatusDiscrepancyReport(): Promise<StoryStatusDiscrepancyReport>;
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

  const loadDaily = createCachedLoader(config.cacheTtlMs, async (): Promise<DailyRow[]> => {
    const [metadata, tasks] = await Promise.all([
      loadTaskMetadata(),
      client.getListTasks(config.listId, dailyTaskQuery)
    ]);

    return buildDailyRows(tasks, metadata.value.taskTypeMap);
  });

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

  return {
    async getDailyRows() {
      return runLogicalRead("daily", loadDaily, (rows) => rows.length);
    },
    async getStoryStatusDiscrepancyReport() {
      return runLogicalRead(
        "story-status-discrepancies",
        loadStoryStatusDiscrepancies,
        (report) => report.discrepancyCount
      );
    }
  };
}
