import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClickUpApiError,
  fetchPlanningPageData,
  formatClickUpRateLimitUsage
} from "./clickup-api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchClickUpResource errors", () => {
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
