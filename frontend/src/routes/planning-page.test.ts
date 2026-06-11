import { describe, expect, it } from "vitest";
import type { SprintPlanningRow } from "@custom-clickup/shared";
import { createOptimisticPlanningTimeRow } from "./planning-page";

function createPlanningRow(overrides: Partial<SprintPlanningRow> = {}): SprintPlanningRow {
  return {
    assignees: [],
    estimateHours: 8,
    missingEstimate: false,
    remainingDays: 0.5,
    remainingHours: 4,
    rolledSubtaskCount: 0,
    sprintLabel: "W24 - CURRENT",
    status: "IN PROGRESS",
    taskCustomId: "CL-1",
    taskId: "task-1",
    taskType: "Task",
    title: "Task 1",
    trackedHours: 4,
    ...overrides
  };
}

describe("planning page helpers", () => {
  it("preserves negative remaining time in optimistic edits", () => {
    const row = createOptimisticPlanningTimeRow(
      createPlanningRow(),
      8,
      {
        trackedHours: 10
      }
    );

    expect(row).toMatchObject({
      estimateHours: 8,
      trackedHours: 10,
      remainingHours: -2,
      remainingDays: -0.25
    });
  });
});
