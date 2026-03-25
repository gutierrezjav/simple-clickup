import { afterEach, describe, expect, it, vi } from "vitest";
import { ClickUpClient } from "../src/clickup/client.js";
import {
  buildDailyRows,
  buildStoryStatusDiscrepancyReport,
  createClickUpReadService
} from "../src/clickup/service.js";
import type { ClickUpTaskPayload } from "../src/clickup/types.js";

const storyTaskTypeId = 1;
const bugTaskTypeId = 2;
const taskTypeMap = new Map<number, string>([
  [storyTaskTypeId, "User Story"],
  [bugTaskTypeId, "Bug"]
]);

function createTask({
  id,
  name,
  status,
  parent,
  customItemId,
  orderindex,
  tags,
  assignees
}: {
  id: string;
  name: string;
  status: string;
  parent?: string;
  customItemId?: number;
  orderindex?: string;
  tags?: Array<{ name: string }>;
  assignees?: Array<{ username?: string; email?: string; profilePicture?: string | null }>;
}): ClickUpTaskPayload {
  return {
    id,
    custom_id: id.toUpperCase(),
    ...(customItemId !== undefined ? { custom_item_id: customItemId } : {}),
    name,
    orderindex: orderindex ?? "0",
    ...(parent ? { parent } : {}),
    ...(tags ? { tags } : {}),
    ...(assignees ? { assignees } : {}),
    status: { status }
  };
}

function collectCardIds(tasks: ClickUpTaskPayload[]): string[] {
  return buildDailyRows(tasks, taskTypeMap).flatMap((row) => row.cards.map((card) => card.id));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildDailyRows", () => {
  it("renders direct child cards under a top-level story row", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Top-level story",
        status: "BACKLOG",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "task-child",
        name: "Direct child task",
        status: "IN PROGRESS",
        parent: "story-parent"
      })
    ];

    const rows = buildDailyRows(tasks, taskTypeMap);
    const storyRow = rows.find((row) => row.id === "story-parent");

    expect(storyRow).toMatchObject({
      id: "story-parent",
      type: "story",
      cards: [{ id: "task-child", status: "IN PROGRESS" }]
    });
  });

  it("keeps top-level task parents and their subtasks in the shared tasks swimlane", () => {
    const tasks = [
      createTask({
        id: "task-parent",
        name: "Top-level task",
        status: "SPRINT BACKLOG",
        orderindex: "1"
      }),
      createTask({
        id: "task-child",
        name: "Task subtask",
        status: "IN PROGRESS",
        parent: "task-parent",
        orderindex: "2"
      })
    ];

    const rows = buildDailyRows(tasks, taskTypeMap);
    const tasksRow = rows.find((row) => row.type === "tasks");

    expect(rows.find((row) => row.id === "task-parent")).toBeUndefined();
    expect(tasksRow?.cards.map((card) => card.id)).toEqual(["task-parent", "task-child"]);
  });

  it("renders nested stories as their own rows and does not treat them as cards", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Top-level story",
        status: "BACKLOG",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "story-child",
        name: "Nested story",
        status: "SPRINT BACKLOG",
        parent: "story-parent",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "task-grandchild",
        name: "Grandchild task",
        status: "IN PROGRESS",
        parent: "story-child"
      })
    ];

    const rows = buildDailyRows(tasks, taskTypeMap);
    const parentRow = rows.find((row) => row.id === "story-parent");
    const nestedStoryRow = rows.find((row) => row.id === "story-child");

    expect(parentRow).toMatchObject({
      id: "story-parent",
      type: "story",
      cards: []
    });
    expect(nestedStoryRow).toMatchObject({
      id: "story-child",
      type: "story",
      cards: [{ id: "task-grandchild", status: "IN PROGRESS" }]
    });
    expect(collectCardIds(tasks)).not.toContain("story-child");
  });

  it("keeps subtasks of tasks in the same story swimlane as their parent task", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Top-level story",
        status: "BACKLOG",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "task-parent",
        name: "Parent task card",
        status: "SPRINT BACKLOG",
        parent: "story-parent",
        orderindex: "1"
      }),
      createTask({
        id: "task-child",
        name: "Nested subtask card",
        status: "IN PROGRESS",
        parent: "task-parent",
        orderindex: "2"
      })
    ];

    const rows = buildDailyRows(tasks, taskTypeMap);
    const storyRow = rows.find((row) => row.id === "story-parent");

    expect(rows.find((row) => row.id === "task-parent")).toBeUndefined();
    expect(storyRow).toMatchObject({
      id: "story-parent",
      type: "story",
      cards: [
        { id: "task-parent", status: "SPRINT BACKLOG" },
        { id: "task-child", status: "IN PROGRESS" }
      ]
    });
  });

  it("keeps a nested story row even when the story itself is outside the daily statuses", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Top-level story",
        status: "BACKLOG",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "story-child",
        name: "Nested story outside board",
        status: "BACKLOG",
        parent: "story-parent",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "task-grandchild",
        name: "Grandchild task still active",
        status: "IN CODE REVIEW",
        parent: "story-child"
      })
    ];

    const rows = buildDailyRows(tasks, taskTypeMap);
    const parentRow = rows.find((row) => row.id === "story-parent");
    const nestedStoryRow = rows.find((row) => row.id === "story-child");

    expect(parentRow).toMatchObject({
      id: "story-parent",
      type: "story",
      cards: []
    });
    expect(nestedStoryRow).toMatchObject({
      id: "story-child",
      type: "story",
      cards: [{ id: "task-grandchild", status: "IN CODE REVIEW" }]
    });
  });

  it("preserves the first assignee avatar URL on daily cards", () => {
    const avatarUrl = "https://attachments.clickup.com/profilePictures/100562605_k93.jpg";
    const tasks = [
      createTask({
        id: "task-with-avatar",
        name: "Task with avatar",
        status: "SPRINT BACKLOG",
        orderindex: "1",
        assignees: [
          {
            username: "Javier Gutierrez",
            profilePicture: avatarUrl
          }
        ]
      })
    ];

    const tasksRow = buildDailyRows(tasks, taskTypeMap).find((row) => row.type === "tasks");

    expect(tasksRow).toMatchObject({
      type: "tasks",
      cards: [
        {
          id: "task-with-avatar",
          assignee: "Javier Gutierrez",
          assigneeAvatarUrl: avatarUrl
        }
      ]
    });
  });
});

describe("buildStoryStatusDiscrepancyReport", () => {
  it("flags stories whose active child tasks are ahead of the story status", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Telemetry setting fixes",
        status: "refined",
        customItemId: storyTaskTypeId,
        orderindex: "1"
      }),
      createTask({
        id: "task-parent",
        name: "Feature flag task",
        status: "IN PROGRESS",
        parent: "story-parent",
        orderindex: "2"
      }),
      createTask({
        id: "task-child",
        name: "Nested validation",
        status: "DEPLOYED TO STAGING",
        parent: "task-parent",
        orderindex: "3"
      }),
      createTask({
        id: "task-review",
        name: "QA review",
        status: "IN CODE REVIEW",
        parent: "story-parent",
        orderindex: "4"
      })
    ];

    expect(buildStoryStatusDiscrepancyReport(tasks, taskTypeMap)).toEqual({
      checkedStoryCount: 1,
      discrepancyCount: 1,
      discrepancies: [
        {
          storyId: "story-parent",
          storyCustomId: "STORY-PARENT",
          storyTitle: "Telemetry setting fixes",
          actualStatus: "REFINED",
          expectedStatus: "IN PROGRESS",
          activeChildCount: 3,
          activeChildStatuses: [
            { name: "IN PROGRESS", count: 1 },
            { name: "IN CODE REVIEW", count: 1 },
            { name: "DEPLOYED TO STAGING", count: 1 }
          ]
        }
      ]
    });
  });

  it("keeps sprint backlog valid only when no active child task has progressed further", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Telemetry setting fixes",
        status: "SPRINT BACKLOG",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "task-backlog",
        name: "Investigate issue",
        status: "SPRINT BACKLOG",
        parent: "story-parent"
      }),
      createTask({
        id: "task-progress",
        name: "Implement fix",
        status: "IN PROGRESS",
        parent: "story-parent"
      })
    ];

    expect(buildStoryStatusDiscrepancyReport(tasks, taskTypeMap)).toEqual({
      checkedStoryCount: 1,
      discrepancyCount: 1,
      discrepancies: [
        {
          storyId: "story-parent",
          storyCustomId: "STORY-PARENT",
          storyTitle: "Telemetry setting fixes",
          actualStatus: "SPRINT BACKLOG",
          expectedStatus: "IN PROGRESS",
          activeChildCount: 2,
          activeChildStatuses: [
            { name: "SPRINT BACKLOG", count: 1 },
            { name: "IN PROGRESS", count: 1 }
          ]
        }
      ]
    });
  });

  it("does not flag sprint backlog stories when every active child task is still in sprint backlog", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Telemetry setting fixes",
        status: "SPRINT BACKLOG",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "task-backlog-1",
        name: "Investigate issue",
        status: "SPRINT BACKLOG",
        parent: "story-parent"
      }),
      createTask({
        id: "task-backlog-2",
        name: "Implement fix",
        status: "SPRINT BACKLOG",
        parent: "story-parent"
      })
    ];

    expect(buildStoryStatusDiscrepancyReport(tasks, taskTypeMap)).toEqual({
      checkedStoryCount: 1,
      discrepancyCount: 0,
      discrepancies: []
    });
  });
});

describe("createClickUpReadService", () => {
  it("keeps daily reads working when optional ClickUp custom fields are removed", async () => {
    vi.spyOn(ClickUpClient.prototype, "getCustomTaskTypes").mockResolvedValue([
      {
        id: storyTaskTypeId,
        name: "User Story"
      }
    ]);
    vi.spyOn(ClickUpClient.prototype, "getListTasks").mockResolvedValue([]);

    const service = createClickUpReadService({
      accessToken: "test-token",
      baseUrl: "https://example.invalid/api/v2",
      cacheTtlMs: 1_000,
      listId: "list-1",
      readMode: "live",
      teamId: "team-1",
      timeoutMs: 1_000,
      tokenSource: "env"
    });

    await expect(service.getDailyRows()).resolves.toMatchObject([
      { id: "tasks-row", type: "tasks", cards: [] },
      { id: "bugs-row", type: "bugs", cards: [] }
    ]);
  });

  it("loads story status discrepancies through the live read service", async () => {
    vi.spyOn(ClickUpClient.prototype, "getCustomTaskTypes").mockResolvedValue([
      {
        id: storyTaskTypeId,
        name: "User Story"
      }
    ]);
    vi.spyOn(ClickUpClient.prototype, "getListTasks").mockResolvedValue([
      createTask({
        id: "story-parent",
        name: "Telemetry setting fixes",
        status: "refined",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "task-progress",
        name: "Implement fix",
        status: "IN PROGRESS",
        parent: "story-parent"
      })
    ]);

    const service = createClickUpReadService({
      accessToken: "test-token",
      baseUrl: "https://example.invalid/api/v2",
      cacheTtlMs: 1_000,
      listId: "list-1",
      readMode: "live",
      teamId: "team-1",
      timeoutMs: 1_000,
      tokenSource: "env"
    });

    await expect(service.getStoryStatusDiscrepancyReport()).resolves.toEqual({
      checkedStoryCount: 1,
      discrepancyCount: 1,
      discrepancies: [
        expect.objectContaining({
          storyId: "story-parent",
          actualStatus: "REFINED",
          expectedStatus: "IN PROGRESS"
        })
      ]
    });
  });
});
