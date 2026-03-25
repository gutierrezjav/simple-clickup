import type { DailyRow } from "@custom-clickup/shared";
import { describe, expect, it } from "vitest";
import {
  filterDailyBoard,
  getVisibleDailyStatuses,
  isDailyStatusCollapsedByDefault
} from "./daily-board";

const rows: DailyRow[] = [
  {
    id: "story-row",
    title: "Telemetry setting fixes",
    type: "story",
    prioScore: 50,
    cards: [
      {
        id: "card-1",
        customId: "CL-100",
        title: "Drone disconnect investigation",
        status: "IN PROGRESS",
        prioScore: 20,
        assignee: "Michele Bolognini"
      },
      {
        id: "card-2",
        customId: "CL-101",
        title: "Preset validation cleanup",
        status: "IN CODE REVIEW",
        prioScore: 10,
        assignee: "Alice Smith"
      }
    ]
  },
  {
    id: "tasks-row",
    title: "Tasks",
    type: "tasks",
    cards: [
      {
        id: "card-3",
        customId: "CL-200",
        title: "Site sorting split",
        status: "SPRINT BACKLOG",
        prioScore: 30,
        assignee: "Michele Bolognini"
      }
    ]
  }
];

describe("filterDailyBoard", () => {
  it("returns the unfiltered board with total counts", () => {
    const result = filterDailyBoard(rows, {
      search: "",
      assignee: ""
    });

    expect(result.filtersActive).toBe(false);
    expect(result.counts.totalCards).toBe(3);
    expect(result.counts.visibleCards).toBe(3);
    expect(result.counts.totalByStatus["SPRINT BACKLOG"]).toBe(1);
    expect(result.counts.visibleByStatus["IN PROGRESS"]).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.cards).toHaveLength(2);
  });

  it("keeps a story row visible when the story title matches search", () => {
    const result = filterDailyBoard(rows, {
      search: "telemetry",
      assignee: ""
    });

    expect(result.filtersActive).toBe(true);
    expect(result.counts.visibleCards).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("story-row");
    expect(result.rows[0]?.cards.map((card) => card.id)).toEqual(["card-1", "card-2"]);
  });

  it("narrows visible cards when the search only matches a card", () => {
    const result = filterDailyBoard(rows, {
      search: "CL-101",
      assignee: ""
    });

    expect(result.counts.visibleCards).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.cards.map((card) => card.id)).toEqual(["card-2"]);
  });

  it("returns only the statuses that still have visible cards", () => {
    const result = filterDailyBoard(rows, {
      search: "CL-101",
      assignee: ""
    });

    expect(getVisibleDailyStatuses(result.rows)).toEqual(["IN CODE REVIEW"]);
  });

  it("keeps sprint backlog, in progress, and code review expanded by default even when empty", () => {
    const visibleStatuses = new Set(getVisibleDailyStatuses([]));

    expect(isDailyStatusCollapsedByDefault("SPRINT BACKLOG", visibleStatuses)).toBe(false);
    expect(isDailyStatusCollapsedByDefault("IN PROGRESS", visibleStatuses)).toBe(false);
    expect(isDailyStatusCollapsedByDefault("IN CODE REVIEW", visibleStatuses)).toBe(false);
    expect(isDailyStatusCollapsedByDefault("BLOCKED", visibleStatuses)).toBe(true);
  });

  it("filters cards by assignee without exposing standalone row titles as search hits", () => {
    const result = filterDailyBoard(rows, {
      search: "tasks",
      assignee: "Michele Bolognini"
    });

    expect(result.rows).toHaveLength(0);
    expect(result.hasVisibleCards).toBe(false);
  });

  it("keeps a title-matched story row even when the assignee filter removes every card", () => {
    const result = filterDailyBoard(rows, {
      search: "telemetry",
      assignee: "Unassigned"
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("story-row");
    expect(result.rows[0]?.cards).toHaveLength(0);
    expect(result.hasVisibleCards).toBe(false);
    expect(getVisibleDailyStatuses(result.rows)).toEqual([]);
  });
});
