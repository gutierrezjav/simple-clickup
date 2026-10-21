import { describe, expect, it, vi } from "vitest";
import { buildSquadsRows, loadSquadsRows } from "../src/clickup/service.js";
import type { ClickUpTaskPayload } from "../src/clickup/types.js";

const types = new Map([[1004, "User Story"], [1005, "Epic"], [1, "Task"], [2, "Bug"]]);
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
    ], types);
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
    expect(buildSquadsRows([task], types).filter(row => row.cards.length)).toHaveLength(1);
    expect(buildSquadsRows([task], types)[0]!.cards).toHaveLength(1);
  });
});


describe("Squads relationships and epic metadata", () => {
  it("uses either direction of ordinary task links, deduplicates roadmap links, and uses epic priority", async () => {
    const first = story("first");
    const second = story("second", "in progress", false);
    const epic: ClickUpTaskPayload = { id: "epic", name: "Epic title", custom_item_id: 1005,
      assignees: [{ username: "Epic Owner", profilePicture: "https://example.com/avatar.png" }],
      custom_fields: [{ name: "Prio score", value: "2" }] };
    const getTask = vi.fn(async (id: string): Promise<ClickUpTaskPayload> => {
      if (id === "epic") return epic;
      if (id === "first") return { ...first, linked_tasks: [{ task_id: "first", link_id: "epic" }] };
      return { ...second, linked_tasks: [{ task_id: "epic", link_id: "second" }] };
    });
    const rows = await loadSquadsRows([first, second], types, getTask);
    expect(rows[0]).toMatchObject({ id: "epic", title: "Epic title", prioScore: 2,
      assignee: "Epic Owner", assigneeAvatarUrl: "https://example.com/avatar.png" });
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
    ], types);
    expect(rows.map(row => [row.type, row.cards.map(card => card.id)])).toEqual([
      ["epic", ["battery", "bug", "parent"]], ["tasks", ["unlinked-task"]], ["bugs", ["unlinked-bug"]]
    ]);
  });

  it("resolves ordinary epic links on an untyped task", async () => {
    const task: ClickUpTaskPayload = { id: "battery", name: "Improve battery estimates", status: "in progress" };
    const getTask = vi.fn(async (id: string): Promise<ClickUpTaskPayload> => id === "battery"
      ? { ...task, linked_tasks: [{ task_id: "epic", link_id: "battery" }] }
      : { id: "epic", name: "Battery epic", custom_item_id: 1005 });
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
        id: "epic", name: "Closed epic", custom_item_id: 1005, status
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
      ["epic", { id: "epic", custom_item_id: 1005, status: "Closed" }],
      ["open-epic", { id: "open-epic", name: "Open epic", custom_item_id: 1005, status: "in progress" }]
    ]);
    const rows = buildSquadsRows([task], types, epics);
    expect(rows.filter(row => row.cards.length).map(row => row.id)).toEqual(["open-epic"]);
  });
});
