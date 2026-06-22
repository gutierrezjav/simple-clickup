import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClickUpApiError,
  fetchPlanningPageData,
  fetchPlanningTaskRollups,
  formatClickUpRateLimitUsage
} from "./clickup-api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchClickUpResource errors", () => {
  it("posts planning task rollup ids as JSON", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        rows: [
          {
            assignees: [],
            estimateHours: 104,
            missingEstimate: false,
            remainingDays: 13,
            remainingHours: 104,
            rolledSubtaskCount: 1,
            sprintLabel: "W24 - CURRENT",
            status: "SPRINT BACKLOG",
            taskCustomId: "CL-7540",
            taskId: "cl-7540",
            taskType: "User Story",
            title: "CL-7540 story",
            trackedHours: 0
          }
        ]
      }),
      {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPlanningTaskRollups(["cl-7540"])).resolves.toMatchObject({
      rows: [
        {
          taskId: "cl-7540",
          estimateHours: 104
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clickup/planning/task-rollups",
      expect.objectContaining({
        body: JSON.stringify({ taskIds: ["cl-7540"] }),
        method: "POST"
      })
    );
  });

  it("preserves rate limit usage details from backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          message: "ClickUp API request budget is temporarily exhausted.",
          rateLimit: {
            remaining: 0,
            total: 90,
            used: 90
          }
        }),
        {
          headers: {
            "content-type": "application/json",
            "retry-after": "31"
          },
          status: 429
        }
      ))
    );

    await expect(fetchPlanningPageData()).rejects.toMatchObject({
      message: "ClickUp API request budget is temporarily exhausted.",
      rateLimit: {
        remaining: 0,
        total: 90,
        used: 90
      },
      retryAfterSeconds: 31,
      status: 429
    });
  });

  it("formats rate limit usage details for UI messages", () => {
    expect(
      formatClickUpRateLimitUsage(
        new ClickUpApiError(
          "ClickUp API request budget is temporarily exhausted.",
          429,
          31,
          {
            remaining: 0,
            total: 90,
            used: 90
          }
        )
      )
    ).toBe(" Request budget: 90 / 90 used.");
  });
});
