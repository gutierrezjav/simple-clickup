import {
  dailyFixtures,
  dailyStatuses,
  planningExcludedStatuses,
  planningFixtures,
  schemaConfig,
  type DailyCard,
  type DailyRow,
  type PlanningItem,
  type SchemaConfig
} from "@custom-clickup/shared";
import { clickupLogger } from "../logging.js";
import { ClickUpClient } from "./client.js";
import { ClickUpServiceError } from "./errors.js";
import type {
  ClickUpCustomFieldOptionPayload,
  ClickUpCustomFieldPayload,
  ClickUpCustomTaskTypePayload,
  ClickUpFieldPayload,
  ClickUpStatusPayload,
  ClickUpTaskPayload,
  ClickUpTaskQueryOptions,
  ClickUpTokenSource,
  ClickUpUserPayload
} from "./types.js";

export type ClickUpReadMode = "mock" | "live";

export interface ClickUpReadServiceConfig {
  accessToken: string | undefined;
  baseUrl: string;
  cacheTtlMs: number;
  listId: string;
  readMode: ClickUpReadMode;
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

interface ClickUpMetadataSnapshot {
  fieldCount: number;
  schema: SchemaConfig;
  taskTypeMap: Map<number, string>;
}

type ReadTarget = "schema" | "planning" | "daily";

const metadataCacheTtlMultiplier = 5;
const planningQueryStatuses = [
  "BACKLOG",
  "BUGS / ISSUES",
  "IN UX DESIGN",
  "READY TO REFINE",
  "SPRINT READY",
  "BLOCKED",
  "SPRINT BACKLOG",
  "IN PROGRESS",
  "IN CODE REVIEW"
] as const;

const planningTaskQuery: ClickUpTaskQueryOptions = {
  archived: false,
  includeClosed: false,
  includeTiml: false,
  statuses: [...planningQueryStatuses],
  subtasks: true
};

const dailyTaskQuery: ClickUpTaskQueryOptions = {
  archived: false,
  includeClosed: false,
  includeTiml: false,
  statuses: [...dailyStatuses],
  subtasks: true
};

const requiredFieldNames = [
  "Prio score",
  "Planning bucket",
  "CL Sprint ID",
  "Epic",
  "Epic-Story",
  "Technical Area",
  "effort",
  "Size (days)"
] as const;

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStatus(status: ClickUpStatusPayload | string | null | undefined): string {
  if (typeof status === "string") {
    return status.trim().toUpperCase();
  }

  return status?.status?.trim().toUpperCase() ?? "UNKNOWN";
}

function firstAssigneeName(assignees: ClickUpUserPayload[] | undefined): string | undefined {
  const assignee = assignees?.[0];
  return assignee?.username?.trim() || assignee?.email?.trim() || undefined;
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

function optionMatchesValue(
  option: ClickUpCustomFieldOptionPayload,
  rawValue: string | number
): boolean {
  if (option.id === rawValue) {
    return true;
  }

  const rawAsString = String(rawValue);
  return String(option.orderindex ?? "") === rawAsString;
}

function parseDropdownField(field: ClickUpCustomFieldPayload | undefined): string | undefined {
  const rawValue = field?.value;
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return undefined;
  }

  const options = field?.type_config?.options;
  if (!options?.length) {
    return undefined;
  }

  const match = options.find((option) => optionMatchesValue(option, rawValue));
  return match?.name?.trim() || undefined;
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

function validateFields(fields: ClickUpFieldPayload[]): void {
  const names = new Set(fields.map((field) => field.name?.trim()).filter(Boolean));
  const missingFields = requiredFieldNames.filter((fieldName) => !names.has(fieldName));

  if (missingFields.length > 0) {
    throw new ClickUpServiceError(
      `Target list is missing required ClickUp fields: ${missingFields.join(", ")}.`,
      502
    );
  }
}

function buildSchema(teamId: string, listId: string): SchemaConfig {
  return {
    workspaceId: teamId,
    listId,
    planningExcludedStatuses,
    dailyStatuses,
    inlineEditableFields: schemaConfig.inlineEditableFields
  };
}

function classifyTask(
  task: ClickUpTaskPayload,
  childIdsByParentId: Map<string, string[]>,
  taskTypeMap: Map<number, string>
): PlanningItem["kind"] {
  const normalizedTaskTypeName = normalizeName(taskTypeMap.get(task.custom_item_id ?? Number.NaN) ?? "");
  const hasChildren = childIdsByParentId.has(task.id ?? "");
  const hasPriorityBugTag = (task.tags ?? []).some((tag) => {
    const tagName = tag.name?.trim().toLowerCase();
    return tagName === "po prio" || tagName === "qa prio";
  });

  if (normalizedTaskTypeName.includes("story") || hasChildren) {
    return "story";
  }

  if (normalizedTaskTypeName.includes("bug") || hasPriorityBugTag) {
    return task.parent ? "subtask" : "standalone-bug";
  }

  return task.parent ? "subtask" : "standalone-task";
}

function toPlanningItem(
  task: ClickUpTaskPayload,
  kind: PlanningItem["kind"],
  childItems: PlanningItem[] = []
): PlanningItem {
  const prioScore = parseNumberField(getCustomField(task, "Prio score"));
  const assignee = firstAssigneeName(task.assignees);
  const planningBucket = parseDropdownField(getCustomField(task, "Planning bucket"));

  return {
    id: task.id ?? "unknown-task",
    customId: task.custom_id ?? task.id ?? "unknown-task",
    title: task.name?.trim() || "Untitled ClickUp task",
    kind,
    status: normalizeStatus(task.status),
    ...(prioScore !== undefined ? { prioScore } : {}),
    ...(assignee ? { assignee } : {}),
    ...(planningBucket ? { planningBucket } : {}),
    ...(childItems.length > 0 ? { children: childItems } : {})
  };
}

function buildPlanningItems(
  tasks: ClickUpTaskPayload[],
  taskTypeMap: Map<number, string>
): PlanningItem[] {
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

    const currentChildren = childIdsByParentId.get(task.parent) ?? [];
    currentChildren.push(taskId);
    childIdsByParentId.set(task.parent, currentChildren);
  }

  return flatTasks
    .filter((task) => !task.parent)
    .map((task) => {
      const kind = classifyTask(task, childIdsByParentId, taskTypeMap);
      const status = normalizeStatus(task.status);
      const hasPriorityBugTag = (task.tags ?? []).some((tag) => {
        const tagName = tag.name?.trim().toLowerCase();
        return tagName === "po prio" || tagName === "qa prio";
      });

      const includeInPlanning =
        status === "SPRINT BACKLOG" ||
        (kind === "story" &&
          !planningExcludedStatuses.includes(status as (typeof planningExcludedStatuses)[number])) ||
        (kind === "standalone-bug" &&
          hasPriorityBugTag &&
          !planningExcludedStatuses.includes(status as (typeof planningExcludedStatuses)[number]));

      if (!includeInPlanning) {
        return null;
      }

      const childItems = (childIdsByParentId.get(task.id ?? "") ?? [])
        .map((childId) => taskById.get(childId))
        .filter((child): child is ClickUpTaskPayload => Boolean(child))
        .filter((child) => normalizeStatus(child.status) !== "CLOSED")
        .map((child) => ({
          item: toPlanningItem(child, "subtask"),
          orderindex: child.orderindex,
          prioScore: parseNumberField(getCustomField(child, "Prio score"))
        }))
        .sort(compareByTaskMetrics)
        .map((entry) => entry.item);

      return {
        item: toPlanningItem(task, kind, childItems),
        orderindex: task.orderindex,
        prioScore: parseNumberField(getCustomField(task, "Prio score"))
      };
    })
    .filter(
      (
        item
      ): item is {
        item: PlanningItem;
        orderindex: string | null | undefined;
        prioScore: number | undefined;
      } => Boolean(item)
    )
    .sort(compareByTaskMetrics)
    .map((entry) => entry.item);
}

function toDailyCard(task: ClickUpTaskPayload): DailyCard {
  const assignee = firstAssigneeName(task.assignees);
  const prioScore = parseNumberField(getCustomField(task, "Prio score"));

  return {
    id: task.id ?? "unknown-task",
    customId: task.custom_id ?? task.id ?? "unknown-task",
    title: task.name?.trim() || "Untitled ClickUp task",
    status: normalizeStatus(task.status) as DailyCard["status"],
    ...(prioScore !== undefined ? { prioScore } : {}),
    ...(assignee ? { assignee } : {})
  };
}

export function buildDailyRows(
  tasks: ClickUpTaskPayload[],
  taskTypeMap: Map<number, string>
): DailyRow[] {
  const flatTasks = flattenTasks(tasks);
  const taskById = new Map<string, ClickUpTaskPayload>();
  const childIdsByParentId = new Map<string, string[]>();
  const taskKindById = new Map<string, PlanningItem["kind"]>();
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

    taskKindById.set(taskId, classifyTask(task, childIdsByParentId, taskTypeMap));
  }

  const hasVisibleDailyContent = (taskId: string): boolean => {
    const childIds = childIdsByParentId.get(taskId) ?? [];

    for (const childId of childIds) {
      const child = taskById.get(childId);
      if (!child) {
        continue;
      }

      const kind = taskKindById.get(childId);
      if (kind === "story") {
        if (hasVisibleDailyContent(childId)) {
          return true;
        }

        continue;
      }

      if (allowedStatuses.has(normalizeStatus(child.status))) {
        return true;
      }
    }

    return false;
  };

  const storyRows = flatTasks
    .map((task) => ({
      kind: taskKindById.get(task.id ?? ""),
      task
    }))
    .filter((entry) => entry.kind === "story")
    .map((entry) => {
      const prioScore = parseNumberField(getCustomField(entry.task, "Prio score"));
      const cards = (childIdsByParentId.get(entry.task.id ?? "") ?? [])
        .map((childId) => taskById.get(childId))
        .filter((child): child is ClickUpTaskPayload => Boolean(child))
        .filter((child) => taskKindById.get(child.id ?? "") !== "story")
        .filter((child) => allowedStatuses.has(normalizeStatus(child.status)))
        .map((child) => ({
          card: toDailyCard(child),
          orderindex: child.orderindex,
          prioScore: parseNumberField(getCustomField(child, "Prio score"))
        }))
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
    .filter((entry) => hasVisibleDailyContent(entry.row.id))
    .sort(compareByTaskMetrics)
    .map((entry) => entry.row);

  const standaloneCards = flatTasks
    .filter((task) => !task.parent && allowedStatuses.has(normalizeStatus(task.status)))
    .map((task) => ({
      kind: classifyTask(task, childIdsByParentId, taskTypeMap),
      task
    }))
    .filter((entry) => entry.kind !== "story");

  const tasksRow: DailyRow = {
    id: "tasks-row",
    title: "Tasks",
    type: "tasks",
    cards: standaloneCards
      .filter((entry) => entry.kind === "standalone-task")
      .map((entry) => ({
        card: toDailyCard(entry.task),
        orderindex: entry.task.orderindex,
        prioScore: parseNumberField(getCustomField(entry.task, "Prio score"))
      }))
      .sort(compareByTaskMetrics)
      .map((entry) => entry.card)
  };

  const bugsRow: DailyRow = {
    id: "bugs-row",
    title: "Bugs",
    type: "bugs",
    cards: standaloneCards
      .filter((entry) => entry.kind === "standalone-bug")
      .map((entry) => ({
        card: toDailyCard(entry.task),
        orderindex: entry.task.orderindex,
        prioScore: parseNumberField(getCustomField(entry.task, "Prio score"))
      }))
      .sort(compareByTaskMetrics)
      .map((entry) => entry.card)
  };

  return [...storyRows, tasksRow, bugsRow];
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
  getPlanningItems(): Promise<PlanningItem[]>;
  getReadMode(): ClickUpReadMode;
  getSchema(): Promise<SchemaConfig>;
}

export function createClickUpReadService(config: ClickUpReadServiceConfig): ClickUpReadService {
  if (config.readMode === "mock") {
    return {
      async getDailyRows() {
        return dailyFixtures;
      },
      async getPlanningItems() {
        return planningFixtures;
      },
      getReadMode() {
        return "mock";
      },
      async getSchema() {
        return buildSchema(config.teamId, config.listId);
      }
    };
  }

  if (!config.accessToken) {
    throw new ClickUpServiceError(
      "Live ClickUp reads require either a configured CLICKUP_ACCESS_TOKEN or an authenticated ClickUp session.",
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

  const loadMetadata = createCachedLoader(metadataCacheTtlMs, async (): Promise<ClickUpMetadataSnapshot> => {
    const [fields, taskTypes] = await Promise.all([
      client.getListFields(config.listId),
      client.getCustomTaskTypes()
    ]);

    validateFields(fields);

    return {
      fieldCount: fields.length,
      schema: buildSchema(config.teamId, config.listId),
      taskTypeMap: buildTaskTypeMap(taskTypes)
    };
  });

  const loadPlanning = createCachedLoader(config.cacheTtlMs, async (): Promise<PlanningItem[]> => {
    const [metadata, tasks] = await Promise.all([
      loadMetadata(),
      client.getListTasks(config.listId, planningTaskQuery)
    ]);

    return buildPlanningItems(tasks, metadata.value.taskTypeMap);
  });

  const loadDaily = createCachedLoader(config.cacheTtlMs, async (): Promise<DailyRow[]> => {
    const [metadata, tasks] = await Promise.all([
      loadMetadata(),
      client.getListTasks(config.listId, dailyTaskQuery)
    ]);

    return buildDailyRows(tasks, metadata.value.taskTypeMap);
  });

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
    async getPlanningItems() {
      return runLogicalRead("planning", loadPlanning, (items) => items.length);
    },
    getReadMode() {
      return "live";
    },
    async getSchema() {
      const metadata = await runLogicalRead("schema", loadMetadata, (value) => value.fieldCount);
      return metadata.schema;
    }
  };
}
