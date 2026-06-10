import { Router, type Request, type Response } from "express";
import {
  clickupTarget,
  type DailyMeetingConfig
} from "@custom-clickup/shared";
import { config } from "../config.js";
import { ClickUpServiceError } from "../clickup/errors.js";
import { buildVerificationSummary } from "../clickup/verification.js";
import {
  clearSession,
  readSession,
  type SessionCookieOptions
} from "../clickup/session.js";
import { createClickUpReadService, type ClickUpReadService } from "../clickup/service.js";
import { logger } from "../logging.js";

export const clickupRouter = Router();

const readServiceByToken = new Map<string, ClickUpReadService>();

type ReadServiceResponseFactory = (
  readService: ClickUpReadService
) => Promise<Record<string, unknown>>;

export interface ClickUpServiceErrorPayload {
  message: string;
  rateLimit?: {
    remaining: number;
    total: number;
    used: number;
  };
}

function getDailyMeetingConfig(): DailyMeetingConfig {
  return {
    excludedAssignees: config.DAILY_MEETING_EXCLUDED_ASSIGNEES,
    ...(config.DAILY_MEETING_FINAL_SPEAKER
      ? { finalSpeaker: config.DAILY_MEETING_FINAL_SPEAKER }
      : {})
  };
}

function getSessionOptions(): SessionCookieOptions | null {
  if (!config.SESSION_SECRET) {
    return null;
  }

  return {
    secret: config.SESSION_SECRET,
    secure: config.SESSION_COOKIE_SECURE
  };
}

function getRequestToken(req: Request): string | undefined {
  const sessionOptions = getSessionOptions();
  if (sessionOptions) {
    const session = readSession(req, sessionOptions);
    return session?.accessToken;
  }

  return undefined;
}

function getReadService(accessToken: string | undefined): ClickUpReadService {
  const tokenSource = accessToken ? "session" : "none";
  const cacheKey = `${tokenSource}:${accessToken ?? "no-token"}`;
  const existingService = readServiceByToken.get(cacheKey);

  if (existingService) {
    return existingService;
  }

  const nextService = createClickUpReadService({
    accessToken,
    baseUrl: config.CLICKUP_API_BASE_URL,
    cacheTtlMs: config.CLICKUP_READ_CACHE_TTL_MS,
    listId: config.CLICKUP_TARGET_LIST_ID,
    planningViewId: config.CLICKUP_PLANNING_VIEW_ID,
    teamId: config.CLICKUP_TARGET_TEAM_ID,
    timeoutMs: config.CLICKUP_HTTP_TIMEOUT_MS,
    tokenSource
  });

  readServiceByToken.set(cacheKey, nextService);
  return nextService;
}

function clampRateLimitUsed(value: number, total: number): number {
  return Math.min(total, Math.max(0, value));
}

export function createClickUpServiceErrorPayload(
  error: ClickUpServiceError
): ClickUpServiceErrorPayload {
  const total =
    error.rateLimitState?.softLimitPerMinute ??
    error.rateLimitState?.upstreamLimit ??
    error.rateLimitState?.limitPerMinute;
  const remaining =
    error.rateLimitState?.remainingInWindow ??
    error.rateLimitState?.upstreamRemaining;

  if (typeof total !== "number" || typeof remaining !== "number") {
    return {
      message: error.message
    };
  }

  return {
    message: error.message,
    rateLimit: {
      remaining,
      total,
      used: clampRateLimitUsed(total - remaining, total)
    }
  };
}

function handleRouteError(
  error: unknown,
  res: Response,
  tokenSource: "session" | undefined
) {
  if (error instanceof ClickUpServiceError) {
    if (tokenSource === "session" && error.statusCode === 401) {
      clearSession(res, config.SESSION_COOKIE_SECURE);
      res.status(401).json(
        createClickUpServiceErrorPayload(
          new ClickUpServiceError(
            "ClickUp session expired or was revoked. Reconnect ClickUp and try again.",
            401,
            undefined,
            error.rateLimitState
          )
        )
      );
      return;
    }

    if (typeof error.retryAfterMs === "number") {
      res.set("retry-after", String(Math.ceil(error.retryAfterMs / 1000)));
    }

    res.status(error.statusCode).json(createClickUpServiceErrorPayload(error));
    return;
  }

  logger.error(
    {
      err: error,
      route: "api/clickup"
    },
    "Unexpected ClickUp route error."
  );
  res.status(500).json({
    message: "Unexpected backend error."
  });
}

async function sendReadServiceResponse(
  req: Request,
  res: Response,
  createResponse: ReadServiceResponseFactory
) {
  const accessToken = getRequestToken(req);
  const tokenSource = accessToken ? "session" : undefined;

  try {
    const readService = getReadService(accessToken);
    res.json(await createResponse(readService));
  } catch (error) {
    handleRouteError(error, res, tokenSource);
  }
}

clickupRouter.get("/daily", async (req, res) => {
  await sendReadServiceResponse(req, res, async (readService) => ({
    dailyMeeting: getDailyMeetingConfig(),
    rows: await readService.getDailyRows()
  }));
});

clickupRouter.get("/planning", async (req, res) => {
  await sendReadServiceResponse(req, res, async (readService) => ({
    report: await readService.getSprintPlanningReport()
  }));
});

clickupRouter.get("/story-status-discrepancies", async (req, res) => {
  await sendReadServiceResponse(req, res, async (readService) => ({
    report: await readService.getStoryStatusDiscrepancyReport()
  }));
});

clickupRouter.get("/verification", async (req, res) => {
  await sendReadServiceResponse(req, res, async (readService) => {
    const daily = await readService.getDailyRows();

    return {
      summary: buildVerificationSummary({
        schema: clickupTarget,
        daily
      })
    };
  });
});
