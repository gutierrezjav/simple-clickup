import type { ClickUpRateLimitState } from "./types.js";

export class ClickUpServiceError extends Error {
  readonly rateLimitState: ClickUpRateLimitState | undefined;
  readonly statusCode: number;
  readonly retryAfterMs: number | undefined;

  constructor(
    message: string,
    statusCode = 500,
    retryAfterMs?: number,
    rateLimitState?: ClickUpRateLimitState
  ) {
    super(message);
    this.name = "ClickUpServiceError";
    this.rateLimitState = rateLimitState;
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}
