import { describe, expect, it } from "vitest";
import { buildVerificationSummary } from "../src/clickup/verification.js";
import type { VerificationSummary } from "@custom-clickup/shared";

describe("buildVerificationSummary", () => {
  it("aggregates daily counts for the verification view", () => {
    const summary = buildVerificationSummary({
      schema: {
        workspaceId: "2199933",
        listId: "901500224401",
        dailyStatuses: [],
        inlineEditableFields: []
      },
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
