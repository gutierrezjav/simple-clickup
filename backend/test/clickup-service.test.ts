import { afterEach, describe, expect, it, vi } from "vitest";
import { ClickUpClient } from "../src/clickup/client.js";
import {
  buildSprintPlanningReport,
  buildDailyRows,
  buildStoryStatusDiscrepancyReport,
  createClickUpReadService
} from "../src/clickup/service.js";
import type { ClickUpTaskPayload } from "../src/clickup/types.js";

const storyTaskTypeId = 1;
const bugTaskTypeId = 2;
const sprintFieldId = "sprint-field";
const hourMs = 3_600_000;
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
  assignees,
  timeEstimate,
  timeSpent,
  sprintValue,
  prioScore,
  subtasks,
  customFields: extraCustomFields
}: {
  id: string;
  name: string;
  status: string;
  parent?: string;
  customItemId?: number;
  orderindex?: string;
  tags?: Array<{ name: string }>;
  assignees?: Array<{ username?: string; email?: string; profilePicture?: string | null }>;
  timeEstimate?: number;
  timeSpent?: number;
  sprintValue?: string | number;
  prioScore?: number;
  subtasks?: ClickUpTaskPayload[];
  customFields?: ClickUpTaskPayload["custom_fields"];
}): ClickUpTaskPayload {
  const customFields = [
    sprintValue !== undefined
      ? {
          id: sprintFieldId,
          name: "Sprint",
          type: "drop_down",
          value: sprintValue
        }
      : undefined,
    prioScore !== undefined
      ? {
          id: "prio-field",
          name: "Prio score",
          type: "number",
          value: prioScore
        }
      : undefined,
    ...(extraCustomFields ?? [])
  ].filter((field): field is NonNullable<typeof field> => Boolean(field));

  return {
    id,
    custom_id: id.toUpperCase(),
    ...(customItemId !== undefined ? { custom_item_id: customItemId } : {}),
    name,
    orderindex: orderindex ?? "0",
    ...(parent ? { parent } : {}),
    ...(tags ? { tags } : {}),
    ...(assignees ? { assignees } : {}),
    ...(timeEstimate !== undefined ? { time_estimate: timeEstimate } : {}),
    ...(timeSpent !== undefined ? { time_spent: timeSpent } : {}),
    ...(customFields.length > 0 ? { custom_fields: customFields } : {}),
    ...(subtasks ? { subtasks } : {}),
    status: { status }
  };
}

function createPlanningMetadata() {
  return {
    dayHours: 8,
    listCustomFields: [
      {
        id: sprintFieldId,
        name: "Sprint",
        type: "drop_down",
        type_config: {
          options: [
            { id: "w22-option", name: "W22", orderindex: 21 },
            { id: "w24-option", name: "W24 - CURRENT", orderindex: 23 },
            { id: "w25-option", name: "W25", orderindex: 24 }
          ]
        }
      }
    ],
    viewId: "234bx-100375"
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

  it("keeps a story row visible even when the story has no child tasks", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Top-level story",
        status: "SPRINT BACKLOG",
        customItemId: storyTaskTypeId,
        assignees: [
          {
            username: "Alice Smith",
            profilePicture: "https://example.com/alice.png"
          }
        ]
      })
    ];

    expect(buildDailyRows(tasks, taskTypeMap)).toEqual([
      {
        id: "story-parent",
        title: "Top-level story",
        type: "story",
        assignee: "Alice Smith",
        assigneeAvatarUrl: "https://example.com/alice.png",
        cards: []
      },
      {
        id: "tasks-row",
        title: "Tasks",
        type: "tasks",
        cards: []
      },
      {
        id: "bugs-row",
        title: "Bugs",
        type: "bugs",
        cards: []
      }
    ]);
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

  it("keeps nested story rows even when no descendant tasks are visible", () => {
    const tasks = [
      createTask({
        id: "story-parent",
        name: "Top-level story",
        status: "SPRINT BACKLOG",
        customItemId: storyTaskTypeId,
        assignees: [
          {
            username: "Parent Owner"
          }
        ]
      }),
      createTask({
        id: "story-child",
        name: "Nested story",
        status: "SPRINT BACKLOG",
        parent: "story-parent",
        customItemId: storyTaskTypeId,
        assignees: [
          {
            username: "Child Owner"
          }
        ]
      })
    ];

    expect(buildDailyRows(tasks, taskTypeMap)).toEqual([
      {
        id: "story-parent",
        title: "Top-level story",
        type: "story",
        assignee: "Parent Owner",
        cards: []
      },
      {
        id: "story-child",
        title: "Nested story",
        type: "story",
        assignee: "Child Owner",
        cards: []
      },
      {
        id: "tasks-row",
        title: "Tasks",
        type: "tasks",
        cards: []
      },
      {
        id: "bugs-row",
        title: "Bugs",
        type: "bugs",
        cards: []
      }
    ]);
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
            username: "Example User",
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
          assignee: "Example User",
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
        orderindex: "1",
        assignees: [
          {
            username: "Alice Smith",
            profilePicture: "https://example.com/alice.png"
          }
        ]
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
          storyAssignee: "Alice Smith",
          storyAssigneeAvatarUrl: "https://example.com/alice.png",
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

describe("buildSprintPlanningReport", () => {
  it("rolls parent and subtask time into sprint planning rows", () => {
    const report = buildSprintPlanningReport(
      [
        createTask({
          id: "story-w24",
          name: "Story W24",
          status: "SPRINT BACKLOG",
          customItemId: storyTaskTypeId,
          sprintValue: 23,
          prioScore: 10,
          timeEstimate: 2 * hourMs,
          timeSpent: hourMs,
          subtasks: [
            createTask({
              id: "task-child",
              name: "Child",
              parent: "story-w24",
              status: "IN PROGRESS",
              timeEstimate: 6 * hourMs,
              timeSpent: 2 * hourMs
            })
          ]
        })
      ],
      taskTypeMap,
      createPlanningMetadata()
    );

    expect(report.totals).toMatchObject({
      estimateHours: 8,
      trackedHours: 3,
      remainingHours: 5,
      remainingDays: 0.625,
      missingEstimateCount: 0,
      rowCount: 1
    });
    expect(report.sprints).toEqual([
      expect.objectContaining({
        label: "W24 - CURRENT",
        weekNumber: 24,
        estimateHours: 8,
        trackedHours: 3,
        remainingHours: 5,
        rowCount: 1
      })
    ]);
    expect(report.rows).toEqual([
      expect.objectContaining({
        taskId: "story-w24",
        taskCustomId: "STORY-W24",
        taskType: "User Story",
        sprintLabel: "W24 - CURRENT",
        sprintWeekNumber: 24,
        prioScore: 10,
        estimateHours: 8,
        trackedHours: 3,
        remainingHours: 5,
        remainingDays: 0.625,
        rolledSubtaskCount: 1,
        missingEstimate: false
      })
    ]);
  });

  it("sorts generic sprint labels by week number and prio score", () => {
    const report = buildSprintPlanningReport(
      [
        createTask({
          id: "w25-no-prio",
          name: "W25 no prio",
          status: "SPRINT BACKLOG",
          sprintValue: "w25-option",
          timeEstimate: hourMs
        }),
        createTask({
          id: "w24-prio-20",
          name: "W24 prio 20",
          status: "SPRINT BACKLOG",
          sprintValue: "w24-option",
          prioScore: 20,
          timeEstimate: hourMs
        }),
        createTask({
          id: "w22-prio-50",
          name: "W22 prio 50",
          status: "SPRINT BACKLOG",
          sprintValue: "w22-option",
          prioScore: 50,
          timeEstimate: hourMs
        }),
        createTask({
          id: "w24-prio-5",
          name: "W24 prio 5",
          status: "SPRINT BACKLOG",
          sprintValue: "w24-option",
          prioScore: 5,
          timeEstimate: hourMs
        })
      ],
      taskTypeMap,
      createPlanningMetadata()
    );

    expect(report.sprints.map((sprint) => sprint.label)).toEqual([
      "W22",
      "W24 - CURRENT",
      "W25"
    ]);
    expect(report.rows.map((row) => row.taskId)).toEqual([
      "w22-prio-50",
      "w24-prio-5",
      "w24-prio-20",
      "w25-no-prio"
    ]);
  });

  it("surfaces ClickUp view custom fields used as planning columns", () => {
    const metadata = createPlanningMetadata();
    const report = buildSprintPlanningReport(
      [
        createTask({
          id: "planning-row",
          name: "Planning row",
          status: "IN PROGRESS",
          sprintValue: 23,
          prioScore: 5,
          timeEstimate: 12 * hourMs,
          assignees: [
            {
              username: "Planning Owner",
              profilePicture: "https://example.invalid/avatar.png"
            }
          ],
          customFields: [
            {
              id: "epic-field",
              name: "Epic",
              type: "drop_down",
              value: { id: "network-option" }
            },
            {
              id: "budget-field",
              name: "Budget",
              type: "drop_down",
              value: { orderindex: 1 }
            }
          ]
        })
      ],
      taskTypeMap,
      {
        ...metadata,
        listCustomFields: [
          ...metadata.listCustomFields,
          {
            id: "epic-field",
            name: "Epic",
            type: "drop_down",
            type_config: {
              options: [
                { id: "network-option", name: "Network PPK", orderindex: 4 }
              ]
            }
          },
          {
            id: "budget-field",
            name: "Budget",
            type: "drop_down",
            type_config: {
              options: [
                { id: "budget-option", name: "New Features", orderindex: 1 }
              ]
            }
          }
        ]
      }
    );

    expect(report.rows[0]).toMatchObject({
      assignees: [
        {
          avatarUrl: "https://example.invalid/avatar.png",
          name: "Planning Owner"
        }
      ],
      epic: "Network PPK",
      budget: "New Features"
    });
  });

  it("does not report visible subtasks as separate top-level planning rows", () => {
    const child = createTask({
      id: "visible-child",
      name: "Visible child",
      parent: "visible-parent",
      status: "IN PROGRESS",
      timeEstimate: 3 * hourMs,
      timeSpent: hourMs
    });

    const report = buildSprintPlanningReport(
      [
        createTask({
          id: "visible-parent",
          name: "Visible parent",
          status: "SPRINT BACKLOG",
          sprintValue: 23,
          timeEstimate: 5 * hourMs,
          subtasks: [child]
        }),
        child
      ],
      taskTypeMap,
      createPlanningMetadata()
    );

    expect(report.rows.map((row) => row.taskId)).toEqual(["visible-parent"]);
    expect(report.totals.estimateHours).toBe(8);
    expect(report.totals.trackedHours).toBe(1);
  });

  it("rolls visible child rows into their visible parent when subtasks are flat", () => {
    const report = buildSprintPlanningReport(
      [
        createTask({
          id: "flat-parent",
          name: "Flat parent",
          status: "SPRINT BACKLOG",
          sprintValue: 23,
          timeEstimate: 5 * hourMs
        }),
        createTask({
          id: "flat-child",
          name: "Flat child",
          parent: "flat-parent",
          status: "IN PROGRESS",
          timeEstimate: 3 * hourMs,
          timeSpent: hourMs
        })
      ],
      taskTypeMap,
      createPlanningMetadata()
    );

    expect(report.rows.map((row) => row.taskId)).toEqual(["flat-parent"]);
    expect(report.rows[0]).toMatchObject({
      estimateHours: 8,
      trackedHours: 1,
      remainingHours: 7,
      rolledSubtaskCount: 1
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
      teamId: "team-1",
      timeoutMs: 1_000,
      tokenSource: "session"
    });

    await expect(service.getDailyRows()).resolves.toMatchObject([
      { id: "tasks-row", type: "tasks", cards: [] },
      { id: "bugs-row", type: "bugs", cards: [] }
    ]);
  });

  it("loads story status discrepancies through the session-backed read service", async () => {
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
      teamId: "team-1",
      timeoutMs: 1_000,
      tokenSource: "session"
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

  it("loads sprint planning through the session-backed read service", async () => {
    vi.spyOn(ClickUpClient.prototype, "getCustomTaskTypes").mockResolvedValue([
      {
        id: storyTaskTypeId,
        name: "User Story"
      }
    ]);
    vi.spyOn(
      ClickUpClient.prototype as unknown as {
        getListCustomFields: (listId: string) => Promise<unknown>;
      },
      "getListCustomFields"
    ).mockResolvedValue(createPlanningMetadata().listCustomFields);
    const getViewTasks = vi.spyOn(
      ClickUpClient.prototype as unknown as {
        getViewTasks: (viewId: string) => Promise<ClickUpTaskPayload[]>;
      },
      "getViewTasks"
    ).mockResolvedValue([
      createTask({
        id: "story-w24",
        name: "Story W24",
        status: "SPRINT BACKLOG",
        customItemId: storyTaskTypeId,
        sprintValue: 23,
        timeEstimate: 2 * hourMs
      }),
      createTask({
        id: "task-child",
        name: "Child",
        parent: "story-w24",
        status: "IN PROGRESS",
        timeEstimate: 6 * hourMs
      })
    ]);
    const getTask = vi.spyOn(
      ClickUpClient.prototype as unknown as {
        getTask: (taskId: string, options: { subtasks: boolean }) => Promise<ClickUpTaskPayload>;
      },
      "getTask"
    ).mockResolvedValue(
      createTask({
        id: "story-w24",
        name: "Story W24",
        status: "SPRINT BACKLOG",
        customItemId: storyTaskTypeId,
        sprintValue: 23,
        timeEstimate: 2 * hourMs,
        subtasks: [
          createTask({
            id: "task-child",
            name: "Child",
            parent: "story-w24",
            status: "IN PROGRESS",
            timeEstimate: 6 * hourMs
          })
        ]
      })
    );

    const service = createClickUpReadService({
      accessToken: "test-token",
      baseUrl: "https://example.invalid/api/v2",
      cacheTtlMs: 1_000,
      listId: "list-1",
      teamId: "team-1",
      timeoutMs: 1_000,
      tokenSource: "session"
    });

    await expect(
      (
        service as unknown as {
          getSprintPlanningReport: () => Promise<{ rows: Array<{ estimateHours: number }> }>;
        }
      ).getSprintPlanningReport()
    ).resolves.toMatchObject({
      rows: [
        {
          taskId: "story-w24",
          estimateHours: 8
        }
      ]
    });
    expect(getViewTasks).toHaveBeenCalledWith("234bx-100375");
    expect(getTask).not.toHaveBeenCalled();
  });
});
