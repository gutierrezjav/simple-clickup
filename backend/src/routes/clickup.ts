import { Router, type Request, type Response } from "express";
import { config } from "../config.js";
import { ClickUpServiceError } from "../clickup/errors.js";
import type { ClickUpTokenSource } from "../clickup/types.js";
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

interface RequestToken {
  source: Exclude<ClickUpTokenSource, "none">;
  value: string;
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

function getRequestToken(req: Request): RequestToken | undefined {
  const sessionOptions = getSessionOptions();
  if (sessionOptions) {
    const session = readSession(req, sessionOptions);
    if (session?.accessToken) {
      return {
        source: "session",
        value: session.accessToken
      };
    }
  }

  if (config.CLICKUP_ACCESS_TOKEN) {
    return {
      source: "env",
      value: config.CLICKUP_ACCESS_TOKEN
    };
  }

  return undefined;
}

function getReadService(requestToken: RequestToken | undefined): ClickUpReadService {
  const tokenSource = requestToken?.source ?? "none";
  const accessToken = requestToken?.value;
  const cacheKey = `${config.CLICKUP_READ_MODE}:${tokenSource}:${accessToken ?? "no-token"}`;
  const existingService = readServiceByToken.get(cacheKey);

  if (existingService) {
    return existingService;
  }

  const nextService = createClickUpReadService({
    accessToken,
    baseUrl: config.CLICKUP_API_BASE_URL,
    cacheTtlMs: config.CLICKUP_READ_CACHE_TTL_MS,
    listId: config.CLICKUP_TARGET_LIST_ID,
    readMode: config.CLICKUP_READ_MODE,
    teamId: config.CLICKUP_TARGET_TEAM_ID,
    timeoutMs: config.CLICKUP_HTTP_TIMEOUT_MS,
    tokenSource
  });

  readServiceByToken.set(cacheKey, nextService);
  return nextService;
}

clickupRouter.use((_req, res, next) => {
  res.set("x-custom-clickup-read-mode", config.CLICKUP_READ_MODE);
  next();
});

function handleRouteError(
  error: unknown,
  res: Response,
  tokenSource: "env" | "session" | undefined
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

clickupRouter.get("/schema", async (req, res) => {
  const requestToken = getRequestToken(req);
  try {
    const readService = getReadService(requestToken);

    res.json({
      schema: await readService.getSchema()
    });
  } catch (error) {
    handleRouteError(error, res, requestToken?.source);
  }
});

clickupRouter.get("/daily", async (req, res) => {
  const requestToken = getRequestToken(req);
  try {
    const readService = getReadService(requestToken);

    res.json({
      rows: await readService.getDailyRows()
    });
  } catch (error) {
    handleRouteError(error, res, requestToken?.source);
  }
});

clickupRouter.get("/story-status-discrepancies", async (req, res) => {
  const requestToken = getRequestToken(req);
  try {
    const readService = getReadService(requestToken);

    res.json({
      report: await readService.getStoryStatusDiscrepancyReport()
    });
  } catch (error) {
    handleRouteError(error, res, requestToken?.source);
  }
});

clickupRouter.get("/verification", async (req, res) => {
  const requestToken = getRequestToken(req);
  try {
    const readService = getReadService(requestToken);
    const [schema, daily] = await Promise.all([
      readService.getSchema(),
      readService.getDailyRows()
    ]);

    res.json({
      summary: buildVerificationSummary({
        schema,
        daily
      })
    });
  } catch (error) {
    handleRouteError(error, res, requestToken?.source);
  }
});

clickupRouter.patch("/tasks/:taskId/status", (req, res) => {
  if (config.CLICKUP_WRITE_MODE !== "mock") {
    res.status(501).json({
      message: "Real ClickUp writes are intentionally disabled in the scaffold."
    });
    return;
  }

  res.json({
    taskId: req.params.taskId,
    updated: true,
    mode: "mock",
    payload: req.body
  });
});

clickupRouter.patch("/tasks/:taskId/fields", (req, res) => {
  if (config.CLICKUP_WRITE_MODE !== "mock") {
    res.status(501).json({
      message: "Real ClickUp writes are intentionally disabled in the scaffold."
    });
    return;
  }

  res.json({
    taskId: req.params.taskId,
    updated: true,
    mode: "mock",
    payload: req.body
  });
});
