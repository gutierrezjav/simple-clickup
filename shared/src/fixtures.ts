import type { DailyRow, SchemaConfig } from "./types.js";
import { dailyStatuses } from "./types.js";

const mockAvatarUrl = "/mock-avatar.svg";

export const schemaConfig: SchemaConfig = {
  workspaceId: "2199933",
  listId: "901500224401",
  dailyStatuses,
  inlineEditableFields: ["Prio score", "Assignee"]
};

export const dailyFixtures: DailyRow[] = [
  {
    id: "story-row-1",
    title: "Telemetry setting fixes",
    type: "story",
    prioScore: 87,
    cards: [
      {
        id: "daily-card-1",
        customId: "CL-8074",
        title: "Telemetry: App stopped communicating with the drone",
        status: "IN PROGRESS",
        prioScore: 55,
        assignee: "Michele Bolognini",
        assigneeAvatarUrl: mockAvatarUrl
      },
      {
        id: "daily-card-2",
        customId: "CL-8121",
        title: "Failure to set default preset",
        status: "IN CODE REVIEW",
        prioScore: 41,
        assignee: "Michele Bolognini",
        assigneeAvatarUrl: mockAvatarUrl
      }
    ]
  },
  {
    id: "tasks-row",
    title: "Tasks",
    type: "tasks",
    cards: [
      {
        id: "daily-card-3",
        customId: "CL-7994",
        title: "sites-1: Site sorting — split E2E + API",
        status: "SPRINT BACKLOG",
        prioScore: 35,
        assignee: "Michele Bolognini",
        assigneeAvatarUrl: mockAvatarUrl
      }
    ]
  },
  {
    id: "bugs-row",
    title: "Bugs",
    type: "bugs",
    cards: [
      {
        id: "daily-card-4",
        customId: "CL-7789",
        title: "WingtraGround processing: unspecified antenna type",
        status: "BLOCKED",
        prioScore: 44,
        assignee: "Unassigned"
      }
    ]
  }
];
