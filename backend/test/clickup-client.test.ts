import { afterEach, describe, expect, it, vi } from "vitest";
import { ClickUpClient } from "../src/clickup/client.js";
import { ClickUpServiceError } from "../src/clickup/errors.js";

const originalFetch = globalThis.fetch;

function createClient(timeoutMs: number): ClickUpClient {
  return new ClickUpClient({
    accessToken: "test-token",
    baseUrl: "https://example.invalid/api/v2",
    teamId: "team-1",
    timeoutMs,
    tokenSource: "session"
  });
}

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

function createAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function createSlowFetch(): typeof fetch {
  return vi.fn((_input, init) => (
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(createAbortError());
      });
    })
  )) as unknown as typeof fetch;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("ClickUpClient", () => {
  it("honors configured 30s timeouts for slow ClickUp requests", async () => {
    vi.useFakeTimers();

    const slowFetch = createSlowFetch();
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(createJsonResponse({ plan: "Business" }))
      .mockImplementation(slowFetch) as unknown as typeof fetch;

    const client = createClient(30_000);
    await client.getWorkspacePlan();

    let outcome: "pending" | "resolved" | "rejected" = "pending";
    const request = client.getListTasks("list-1")
      .then(() => {
        outcome = "resolved";
      })
      .catch((error: unknown) => {
        outcome = "rejected";
        return error;
      });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(outcome).toBe("pending");

    await vi.advanceTimersByTimeAsync(20_000);
    const error = await request;

    expect(outcome).toBe("rejected");
    expect(error).toBeInstanceOf(ClickUpServiceError);
    expect((error as ClickUpServiceError).statusCode).toBe(504);
  });
});
