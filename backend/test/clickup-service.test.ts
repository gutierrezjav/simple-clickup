import { describe, expect, it } from "vitest";
import { buildDailyRows, buildPlanningItems } from "../src/clickup/service.js";
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

describe("buildPlanningItems", () => {
  it("includes stories, priority bugs, and sprint backlog tasks while excluding deployed stories and untagged bugs", () => {
    const tasks = [
      createTask({
        id: "story-included",
        name: "Included story",
        status: "BACKLOG",
        customItemId: storyTaskTypeId,
        orderindex: "1"
      }),
      createTask({
        id: "priority-bug",
        name: "Priority bug",
        status: "BUGS / ISSUES",
        customItemId: bugTaskTypeId,
        orderindex: "2",
        tags: [{ name: "qa prio" }]
      }),
      createTask({
        id: "untagged-bug",
        name: "Untracked bug",
        status: "BUGS / ISSUES",
        customItemId: bugTaskTypeId,
        orderindex: "3"
      }),
      createTask({
        id: "sprint-task",
        name: "Sprint backlog task",
        status: "SPRINT BACKLOG",
        orderindex: "4"
      }),
      createTask({
        id: "deployed-story",
        name: "Deployed story",
        status: "DEPLOYED TO DEV",
        customItemId: storyTaskTypeId,
        orderindex: "5"
      })
    ];

    expect(buildPlanningItems(tasks, taskTypeMap)).toMatchObject([
      { id: "story-included", kind: "story", status: "BACKLOG" },
      { id: "priority-bug", kind: "standalone-bug", status: "BUGS / ISSUES" },
      { id: "sprint-task", kind: "standalone-task", status: "SPRINT BACKLOG" }
    ]);
  });

  it("keeps only non-closed children on planning items and sorts them by task metrics", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Parent story",
        status: "SPRINT READY",
        customItemId: storyTaskTypeId
      }),
      createTask({
        id: "child-high-prio",
        name: "High priority child",
        status: "IN PROGRESS",
        parent: "story-parent",
        orderindex: "9"
      }),
      createTask({
        id: "child-low-prio",
        name: "Low priority child",
        status: "BLOCKED",
        parent: "story-parent",
        orderindex: "10"
      }),
      createTask({
        id: "child-closed",
        name: "Closed child",
        status: "CLOSED",
        parent: "story-parent",
        orderindex: "1"
      })
    ];

    tasks[1].custom_fields = [{ name: "Prio score", value: 10 }];
    tasks[2].custom_fields = [{ name: "Prio score", value: 40 }];
    tasks[3].custom_fields = [{ name: "Prio score", value: 1 }];

    const [story] = buildPlanningItems(tasks, taskTypeMap);

    expect(story).toMatchObject({
      id: "story-parent",
      children: [
        { id: "child-high-prio", kind: "subtask", status: "IN PROGRESS", prioScore: 10 },
        { id: "child-low-prio", kind: "subtask", status: "BLOCKED", prioScore: 40 }
      ]
    });
    expect(story?.children?.map((child) => child.id)).toEqual([
      "child-high-prio",
      "child-low-prio"
    ]);
  });

  it("keeps top-level tasks with subtasks classified as standalone tasks", () => {
    const tasks = [
      createTask({
        id: "task-parent",
        name: "Parent task",
        status: "SPRINT BACKLOG",
        orderindex: "1"
      }),
      createTask({
        id: "task-child",
        name: "Child task",
        status: "IN PROGRESS",
        parent: "task-parent",
        orderindex: "2"
      })
    ];

    const [task] = buildPlanningItems(tasks, taskTypeMap);

    expect(task).toMatchObject({
      id: "task-parent",
      kind: "standalone-task",
      children: [{ id: "task-child", kind: "subtask", status: "IN PROGRESS" }]
    });
  });

  it("parses budget values from list metadata when task payloads omit dropdown options", () => {
    const tasks = [
      createTask({
        id: "story-with-budget",
        name: "Story with budget",
        status: "SPRINT READY",
        customItemId: storyTaskTypeId
      })
    ];

    tasks[0].custom_fields = [
      {
        name: "Budget",
        value: "bucket-high"
      }
    ];

    const [story] = buildPlanningItems(
      tasks,
      taskTypeMap,
      new Map([
        [
          "Budget",
          {
            name: "Budget",
            type_config: {
              options: [
                {
                  id: "bucket-high",
                  name: "High"
                }
              ]
            }
          }
        ]
      ])
    );

    expect(story).toMatchObject({
      id: "story-with-budget",
      budget: "High"
    });
  });

  it("preserves the first assignee avatar URL on planning items and daily cards", () => {
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

    expect(buildPlanningItems(tasks, taskTypeMap)).toMatchObject([
      {
        id: "task-with-avatar",
        assignee: "Javier Gutierrez",
        assigneeAvatarUrl: avatarUrl
      }
    ]);

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
});
