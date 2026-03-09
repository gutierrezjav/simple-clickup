export class ClickUpServiceError extends Error {
  readonly statusCode: number;
  readonly retryAfterMs: number | undefined;

  constructor(message: string, statusCode = 500, retryAfterMs?: number) {
    super(message);
    this.name = "ClickUpServiceError";
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}
