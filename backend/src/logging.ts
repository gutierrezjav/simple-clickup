import pino from "pino";
import pretty from "pino-pretty";
import { config } from "./config.js";

type LogObject = Record<string, unknown>;

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function formatBudget(rateLimit: unknown): string | undefined {
  if (typeof rateLimit !== "object" || rateLimit === null) {
    return undefined;
  }

  const record = rateLimit as LogObject;
  const remainingInWindow = getNumber(record.remainingInWindow);
  const softLimitPerMinute = getNumber(record.softLimitPerMinute);
  if (typeof remainingInWindow === "number" && typeof softLimitPerMinute === "number") {
    return `budget=${remainingInWindow}/${softLimitPerMinute}`;
  }

  const upstreamRemaining = getNumber(record.upstreamRemaining);
  const upstreamLimit = getNumber(record.upstreamLimit);
  if (typeof upstreamRemaining === "number" && typeof upstreamLimit === "number") {
    return `upstream=${upstreamRemaining}/${upstreamLimit}`;
  }

  return undefined;
}

function formatPrettyMessage(log: LogObject, messageKey: string): string {
  const event = getString(log.event);
  const message = getString(log[messageKey]);
  const method = getString(log.method);
  const path = getString(log.url) ?? getString(log.pathname);
  const status = getNumber(log.http_status);
  const durationMs = getNumber(log.duration_ms);
  const responseItems = getNumber(log.response_items);
  const itemCount = getNumber(log.item_count);
  const clickUpRequestCount = getNumber(log.clickup_request_count);
  const cacheHit = getBoolean(log.cache_hit);
  const retryAfterMs = getNumber(log.retry_after_ms);
  const readTarget = getString(log.read_target);
  const port = getNumber(log.port);

  const parts: string[] = [];

  if (event) {
    parts.push(event);
  }

  if (readTarget) {
    parts.push(`target=${readTarget}`);
  }

  if (method || path) {
    parts.push([method, path].filter(Boolean).join(" "));
  }

  if (typeof status === "number") {
    parts.push(String(status));
  }

  if (typeof durationMs === "number") {
    parts.push(`${durationMs}ms`);
  }

  if (typeof responseItems === "number") {
    parts.push(`items=${responseItems}`);
  }

  if (typeof itemCount === "number") {
    parts.push(`count=${itemCount}`);
  }

  if (typeof clickUpRequestCount === "number") {
    parts.push(`reqs=${clickUpRequestCount}`);
  }

  if (typeof cacheHit === "boolean") {
    parts.push(cacheHit ? "cache=hit" : "cache=miss");
  }

  if (typeof retryAfterMs === "number") {
    parts.push(`retry=${Math.ceil(retryAfterMs / 1000)}s`);
  }

  const budget = formatBudget(log.rate_limit);
  if (budget) {
    parts.push(budget);
  }

  if (typeof port === "number") {
    parts.push(`port=${port}`);
  }

  if (message && !parts.includes(message)) {
    parts.push(message);
  }

  return parts.join(" ");
}

function createDestination() {
  if (config.LOG_FORMAT === "json") {
    return undefined;
  }

  return pretty({
    colorize: process.stdout.isTTY,
    ignore:
      "pid,hostname,service,integration,component,list_id,team_id,token_source,port,event,read_target,method,pathname,url,http_status,duration_ms,response_items,item_count,clickup_request_count,cache_hit,retry_after_ms,rate_limit",
    messageFormat: (log, messageKey) => formatPrettyMessage(log as LogObject, messageKey),
    singleLine: true,
    translateTime: "HH:MM:ss.l"
  });
}

export const logger = pino(
  {
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: "custom-clickup-backend"
    }
  },
  createDestination()
);

export const clickupLogger = logger.child({
  integration: "clickup"
});
