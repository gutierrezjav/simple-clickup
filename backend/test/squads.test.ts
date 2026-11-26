import { describe, expect, it, vi } from "vitest";
import { buildSquadsRows, loadSquadsRows } from "../src/clickup/service.js";
import type { ClickUpTaskPayload } from "../src/clickup/types.js";

const types = new Map([[1004, "User Story"], [1005, "Epic"], [1, "Task"], [2, "Bug"]]);
const eligibleEpic: ClickUpTaskPayload = {
  id: "epic", custom_item_id: 1005, due_date: "1900000000000",
  custom_fields: [{ name: "Squads", value: { name: "Saentis" } }]
};
const eligibleEpics = new Map([["epic", eligibleEpic]]);
const story = (id: string, status = "in progress", linked = true): ClickUpTaskPayload => ({
  id, name: id, custom_item_id: 1004, status,
  custom_fields: linked ? [{ type: "list_relationship", name: "Roadmap", value: [
    { id: "epic", name: "Quad Support", custom_type: 1005 }
  ] }] : []
});

describe("Squads board", () => {
  it("collapses stories, excludes backlog and closed stories, and preserves standalone work", () => {
    const rows = buildSquadsRows([
      story("active"), story("backlog", "backlog"), story("closed", "closed"),
      story("unlinked", "sprint backlog", false),
      { id: "child", parent: "active", status: "in progress" },
      { id: "task", custom_item_id: 1, status: "in code review" },
      { id: "bug", custom_item_id: 2, status: "blocked" }
    ], types, eligibleEpics);
    expect(rows.map(row => [row.title, row.cards.map(card => card.id)])).toEqual([
      ["Quad Support", ["active"]], ["No Epic", ["unlinked"]],
      ["Tasks", ["task"]], ["Bugs", ["bug"]]
    ]);
  });

  it("deduplicates epic links and ignores deleted or non-epic relationships", () => {
    const task = story("active");
    task.custom_fields![0]!.value = [
      { id: "epic", name: "Quad Support", custom_type: 1005 },
      { id: "epic", name: "Quad Support", custom_type: 1005 },
      { id: "deleted", custom_type: 1005, deleted: true },
      { id: "other-story", custom_type: 1004 }
    ];
    expect(buildSquadsRows([task], types, eligibleEpics).filter(row => row.cards.length)).toHaveLength(1);
    expect(buildSquadsRows([task], types, eligibleEpics)[0]!.cards).toHaveLength(1);
  });
});


describe("Squads relationships and epic metadata", () => {
  it("uses either direction of ordinary task links, deduplicates roadmap links, and reads epic priority and squad", async () => {
    const first = story("first");
    const second = story("second", "in progress", false);
    const epic: ClickUpTaskPayload = { ...eligibleEpic, name: "Epic title",
      assignees: [{ username: "Epic Owner", profilePicture: "https://example.com/avatar.png" }],
      custom_fields: [
        { name: "Prio score", value: "2" },
        { name: "Squads", type: "drop_down", value: 0,
          type_config: { options: [{ id: "saentis", name: "Saentis", orderindex: 0, color: "#b6b6ff" }] } }
      ] };
    const getTask = vi.fn(async (id: string): Promise<ClickUpTaskPayload> => {
      if (id === "epic") return epic;
      if (id === "first") return { ...first, linked_tasks: [{ task_id: "first", link_id: "epic" }] };
      return { ...second, linked_tasks: [{ task_id: "epic", link_id: "second" }] };
    });
    const rows = await loadSquadsRows([first, second], types, getTask);
    expect(rows[0]).toMatchObject({ id: "epic", title: "Epic title", prioScore: 2, squad: "Saentis",
      squadColor: "#b6b6ff", assignee: "Epic Owner", assigneeAvatarUrl: "https://example.com/avatar.png" });
    expect(rows[0]!.cards.map(card => card.id)).toEqual(["first", "second"]);
    expect(getTask.mock.calls.filter(([id]) => id === "epic")).toHaveLength(1);
  });

  it("keeps links to non-epic tasks in No Epic", () => {
    const task = { ...story("active", "in progress", false), linked_tasks: [{ task_id: "active", link_id: "other" }] };
    const linked = new Map([["other", { id: "other", custom_item_id: 1 }]]);
    expect(buildSquadsRows([task], types, linked)[0]!.type).toBe("mix");
  });

  it("puts Test failures in Bugs without exposing its child tasks", () => {
    const task = { ...story("86ca35wbt", "sprint backlog", false), custom_id: "CL-9050", name: "Test failures" };
    const rows = buildSquadsRows([task, { id: "child", parent: task.id, status: "in progress" }], types);
    expect(rows.filter(row => row.cards.length).map(row => [row.type, row.cards.map(card => card.id)]))
      .toEqual([["bugs", [task.id]]]);
  });
});


describe("Standalone work with epics", () => {
  it("groups tasks and bugs by epic without duplicating them in the bottom rows", () => {
    const task = { ...story("battery"), custom_item_id: 1 };
    const bug = { ...story("bug"), custom_item_id: 2 };
    const rows = buildSquadsRows([
      task, bug, { ...story("unlinked-task", "in progress", false), custom_item_id: 1 },
      { ...story("unlinked-bug", "in progress", false), custom_item_id: 2 },
      story("parent"), { ...task, id: "story-child", parent: "parent" }
    ], types, eligibleEpics);
    expect(rows.map(row => [row.type, row.cards.map(card => card.id)])).toEqual([
      ["epic", ["battery", "bug", "parent"]], ["tasks", ["unlinked-task"]], ["bugs", ["unlinked-bug"]]
    ]);
  });

  it("resolves ordinary epic links on an untyped task", async () => {
    const task: ClickUpTaskPayload = { id: "battery", name: "Improve battery estimates", status: "in progress" };
    const getTask = vi.fn(async (id: string): Promise<ClickUpTaskPayload> => id === "battery"
      ? { ...task, linked_tasks: [{ task_id: "epic", link_id: "battery" }] }
      : { ...eligibleEpic, name: "Battery epic" });
    const rows = await loadSquadsRows([task], types, getTask);
    expect(rows.filter(row => row.cards.length).map(row => [row.type, row.title, row.cards.map(card => card.id)]))
      .toEqual([["epic", "Battery epic", ["battery"]]]);
  });
});


describe("Closed epics", () => {
  it.each(["Closed", { status: "Archived outcome", type: "closed" }])(
    "hides closed epics for both Roadmap and ordinary links (%j)", async status => {
      const roadmapStory = { ...story("roadmap"), linked_tasks: [] };
      const linkedTask: ClickUpTaskPayload = { id: "linked-task", status: "in progress",
        linked_tasks: [{ task_id: "epic", link_id: "linked-task" }] };
      const getTask = vi.fn(async (): Promise<ClickUpTaskPayload> => ({
        ...eligibleEpic, name: "Closed epic", status
      }));
      const rows = await loadSquadsRows([roadmapStory, linkedTask], types, getTask);
      expect(rows.filter(row => row.cards.length)).toEqual([]);
      expect(rows.some(row => row.type === "epic" || row.type === "mix")).toBe(false);
    }
  );

  it("keeps open epic associations when the same story also links to a closed epic", () => {
    const task = story("active");
    task.linked_tasks = [{ task_id: "active", link_id: "open-epic" }];
    const epics = new Map<string, ClickUpTaskPayload>([
      ["epic", { ...eligibleEpic, status: "Closed" }],
      ["open-epic", { ...eligibleEpic, id: "open-epic", name: "Open epic", status: "in progress" }]
    ]);
    const rows = buildSquadsRows([task], types, epics);
    expect(rows.filter(row => row.cards.length).map(row => row.id)).toEqual(["open-epic"]);
  });
});

describe("Epic squad and due date", () => {
  it.each([
    ["both fields", eligibleEpic, true],
    ["no squad", { ...eligibleEpic, custom_fields: [] }, false],
    ["no due date", { ...eligibleEpic, due_date: null }, false],
    ["neither field", { id: "epic", custom_item_id: 1005 }, false]
  ])("handles %s", (_description, epic, visible) => {
    const rows = buildSquadsRows([story("linked"), story("unlinked", "in progress", false)], types,
      new Map([["epic", epic]]));
    expect(rows.some(row => row.id === "epic")).toBe(visible);
    expect(rows.find(row => row.id === "no-epic")?.cards.map(card => card.id)).toEqual(["unlinked"]);
  });
});
