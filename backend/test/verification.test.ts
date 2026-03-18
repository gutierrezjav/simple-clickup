import { describe, expect, it } from "vitest";
import { buildVerificationSummary } from "../src/clickup/verification.js";
import type { VerificationSummary } from "@custom-clickup/shared";

describe("buildVerificationSummary", () => {
  it("aggregates planning and daily counts for the verification view", () => {
    const summary = buildVerificationSummary({
      schema: {
        workspaceId: "2199933",
        listId: "901500224401",
        planningExcludedStatuses: [],
        dailyStatuses: [],
        inlineEditableFields: []
      },
      planning: [
        {
          id: "story-1",
          customId: "CL-1",
          title: "Story",
          kind: "story",
          status: "SPRINT READY",
          prioScore: 3,
          budget: "High",
          children: [
            {
              id: "subtask-1",
              customId: "CL-2",
              title: "Subtask",
              kind: "subtask",
              status: "IN PROGRESS",
              assignee: "Ada"
            }
          ]
        },
        {
          id: "bug-1",
          customId: "CL-3",
          title: "Bug",
          kind: "standalone-bug",
          status: "BUGS / ISSUES",
          assignee: "Grace",
          prioScore: 7
        }
      ],
      daily: [
        {
          id: "story-row",
          title: "Story row",
          type: "story",
          cards: [
            {
              id: "card-1",
              customId: "CL-2",
              title: "Card",
              status: "IN PROGRESS",
              assignee: "Ada"
            }
          ]
        },
        {
          id: "bugs-row",
          title: "Bugs",
          type: "bugs",
          cards: []
        }
      ]
    });

    expect(summary).toMatchObject<VerificationSummary>({
      schema: {
        workspaceId: "2199933",
        listId: "901500224401"
      },
      planning: {
        itemCount: 2,
        childCount: 1,
        missingAssigneeCount: 1,
        missingBudgetCount: 1,
        missingPrioScoreCount: 1,
        byKind: [
          { name: "standalone-bug", count: 1 },
          { name: "story", count: 1 },
          { name: "subtask", count: 1 }
        ],
        byStatus: [
          { name: "BUGS / ISSUES", count: 1 },
          { name: "IN PROGRESS", count: 1 },
          { name: "SPRINT READY", count: 1 }
        ]
      },
      daily: {
        rowCount: 2,
        cardCount: 1,
        storyRowCount: 1,
        storyRowsWithoutCards: 0,
        missingAssigneeCount: 0,
        missingPrioScoreCount: 1,
        byRowType: [
          { name: "bugs", count: 1 },
          { name: "story", count: 1 }
        ],
        byStatus: [{ name: "IN PROGRESS", count: 1 }]
      }
    });
  });
});
