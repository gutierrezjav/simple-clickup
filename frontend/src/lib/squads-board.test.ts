import { describe, expect, it } from "vitest";
import type { DailyRow } from "@custom-clickup/shared";
import { getExpandedSquadsRows, sortSquadsRows } from "./squads-board";

const row = (id: string, type: DailyRow["type"], prioScore?: number): DailyRow => ({
  id, title: id, type, ...(prioScore !== undefined ? { prioScore } : {}),
  cards: [{ id: `${id}-card`, customId: id, title: id, status: "DEPLOYED TO STAGING", prioScore: 0 }]
});

describe("Squads row layout", () => {
  it("sorts by epic priority, with missing priority last, then Mix, Tasks, and Bugs", () => {
    const rows = [row("bugs", "bugs", 0), row("unset", "epic"), row("low", "epic", 4),
      row("mix", "mix"), row("tasks", "tasks", 0), row("high", "epic", 1)];
    expect(sortSquadsRows(rows).map(row => row.id)).toEqual(["high", "low", "unset", "mix", "tasks", "bugs"]);
  });

  it("hides epic rows with no expanded cards and restores them when a column opens", () => {
    const rows = [row("staging", "epic"), row("active", "epic"), row("mix", "mix"), row("tasks", "tasks"), row("bugs", "bugs")];
    rows[1]!.cards.push({ id: "active", customId: "active", title: "Active", status: "IN PROGRESS" });
    expect(getExpandedSquadsRows(rows, status => status === "DEPLOYED TO STAGING").map(row => row.id))
      .toEqual(["active", "mix", "tasks", "bugs"]);
    expect(getExpandedSquadsRows(rows, () => false)).toEqual(rows);
    expect(getExpandedSquadsRows(rows, () => true).map(row => row.id)).toEqual(["mix", "tasks", "bugs"]);
  });
});
