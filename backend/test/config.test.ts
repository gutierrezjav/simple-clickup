import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("config", () => {
  it("parses daily meeting helper env vars from trimmed strings", async () => {
    process.env.DAILY_MEETING_EXCLUDED_ASSIGNEES = " First Person , Second Person ,, ";
    process.env.DAILY_MEETING_FINAL_SPEAKER = " Tail Speaker ";

    const { config } = await import("../src/config.js");

    expect(config.DAILY_MEETING_EXCLUDED_ASSIGNEES).toEqual([
      "First Person",
      "Second Person"
    ]);
    expect(config.DAILY_MEETING_FINAL_SPEAKER).toBe("Tail Speaker");
  });
});
