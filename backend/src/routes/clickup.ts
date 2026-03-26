import { Router, type Request, type Response } from "express";
import { clickupTarget } from "@custom-clickup/shared";
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
    teamId: config.CLICKUP_TARGET_TEAM_ID,
    timeoutMs: config.CLICKUP_HTTP_TIMEOUT_MS,
    tokenSource
  });

  readServiceByToken.set(cacheKey, nextService);
  return nextService;
}

function handleRouteError(
  error: unknown,
  res: Response,
  tokenSource: "session" | undefined
) {
  if (error instanceof ClickUpServiceError) {
    if (tokenSource === "session" && error.statusCode === 401) {
      clearSession(res, config.SESSION_COOKIE_SECURE);
      res.status(401).json({
        message: "ClickUp session expired or was revoked. Reconnect ClickUp and try again."
      });
      return;
    }

    if (typeof error.retryAfterMs === "number") {
      res.set("retry-after", String(Math.ceil(error.retryAfterMs / 1000)));
    }

    res.status(error.statusCode).json({
      message: error.message
    });
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
    rows: await readService.getDailyRows()
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
