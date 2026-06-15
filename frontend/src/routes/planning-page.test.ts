import { describe, expect, it } from "vitest";
import type { SprintPlanningReport, SprintPlanningRow } from "@custom-clickup/shared";
import {
  createOptimisticPlanningTimeRow,
  getChangedPlanningSprintLabels,
  replacePlanningReportRow,
  getPlanningRollupTaskIds
} from "./planning-page";

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

function createPlanningReport(
  rows: SprintPlanningRow[],
  sprints: SprintPlanningReport["sprints"] = []
): SprintPlanningReport {
  return {
    dayHours: 8,
    rows,
    sprintOptions: [],
    sprints,
    totals: {
      estimateHours: rows.reduce((total, row) => total + row.estimateHours, 0),
      missingEstimateCount: 0,
      remainingDays: rows.reduce((total, row) => total + row.remainingDays, 0),
      remainingHours: rows.reduce((total, row) => total + row.remainingHours, 0),
      rowCount: rows.length,
      trackedHours: rows.reduce((total, row) => total + row.trackedHours, 0)
    },
    viewId: "planning-view"
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

  it("selects user story rollup ids by priority and caps unassigned stories", () => {
    const unassignedStories = Array.from({ length: 16 }, (_, index) =>
      createPlanningRow({
        prioScore: index + 100,
        sprintLabel: "Unassigned Sprint",
        taskId: `unassigned-${index + 1}`,
        taskType: "User Story"
      })
    );
    const report = createPlanningReport([
      createPlanningRow({
        prioScore: 10,
        sprintLabel: "W24 - CURRENT",
        taskId: "assigned-prio-10",
        taskType: "User Story"
      }),
      createPlanningRow({
        prioScore: 1,
        sprintLabel: "W25",
        taskId: "assigned-prio-1",
        taskType: "User Story"
      }),
      createPlanningRow({
        prioScore: 0,
        sprintLabel: "W25",
        taskId: "not-story",
        taskType: "Task"
      }),
      createPlanningRow({
        sprintLabel: "W24 - CURRENT",
        taskId: "assigned-no-prio",
        taskType: "User Story"
      }),
      ...unassignedStories
    ]);

    const taskIds = getPlanningRollupTaskIds(report);

    expect(taskIds.slice(0, 3)).toEqual([
      "assigned-prio-1",
      "assigned-prio-10",
      "unassigned-1"
    ]);
    expect(taskIds).toContain("assigned-no-prio");
    expect(taskIds).not.toContain("not-story");
    expect(taskIds).not.toContain("unassigned-16");
    expect(taskIds.filter((taskId) => taskId.startsWith("unassigned-"))).toHaveLength(15);
  });

  it("rebuilds sprint totals when replacing a refreshed or edited row", () => {
    const report = createPlanningReport([
      createPlanningRow({
        estimateHours: 8,
        remainingDays: 0.5,
        remainingHours: 4,
        sprintLabel: "W24 - CURRENT",
        taskId: "task-1",
        trackedHours: 4
      }),
      createPlanningRow({
        estimateHours: 3,
        remainingDays: 0.25,
        remainingHours: 2,
        sprintLabel: "W25",
        taskId: "task-2",
        trackedHours: 1
      })
    ]);

    const nextReport = replacePlanningReportRow(
      report,
      createPlanningRow({
        estimateHours: 10,
        remainingDays: 1,
        remainingHours: 8,
        sprintLabel: "W25",
        taskId: "task-1",
        trackedHours: 2
      })
    );

    expect(nextReport.totals).toMatchObject({
      estimateHours: 13,
      remainingDays: 1.25,
      remainingHours: 10,
      rowCount: 2,
      trackedHours: 3
    });
    expect(nextReport.sprints).toEqual([
      expect.objectContaining({
        estimateHours: 13,
        label: "W25",
        remainingHours: 10,
        rowCount: 2,
        trackedHours: 3
      })
    ]);
  });

  it("reports sprint labels whose totals changed so the UI can animate them", () => {
    const previousReport = createPlanningReport(
      [
        createPlanningRow({
          estimateHours: 8,
          remainingDays: 1,
          remainingHours: 8,
          sprintLabel: "W24 - CURRENT",
          taskId: "task-1",
          trackedHours: 0
        })
      ],
      [
        {
          estimateHours: 8,
          label: "W24 - CURRENT",
          missingEstimateCount: 0,
          remainingDays: 1,
          remainingHours: 8,
          rowCount: 1,
          trackedHours: 0
        }
      ]
    );
    const nextReport = replacePlanningReportRow(
      previousReport,
      createPlanningRow({
        estimateHours: 8,
        remainingDays: 1,
        remainingHours: 8,
        sprintLabel: "W25",
        taskId: "task-1",
        trackedHours: 0
      })
    );

    expect(getChangedPlanningSprintLabels(previousReport, nextReport)).toEqual([
      "W24 - CURRENT",
      "W25"
    ]);
  });
});
