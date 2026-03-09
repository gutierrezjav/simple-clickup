import { Router, type Response } from "express";
import { createClickUpReadService } from "../clickup/service.js";
import { ClickUpServiceError } from "../clickup/errors.js";
import { config } from "../config.js";

export const clickupRouter = Router();
const clickupReadService = createClickUpReadService({
  accessToken: config.CLICKUP_ACCESS_TOKEN,
  baseUrl: config.CLICKUP_API_BASE_URL,
  cacheTtlMs: config.CLICKUP_READ_CACHE_TTL_MS,
  listId: config.CLICKUP_TARGET_LIST_ID,
  readMode: config.CLICKUP_READ_MODE,
  teamId: config.CLICKUP_TARGET_TEAM_ID,
  timeoutMs: config.CLICKUP_HTTP_TIMEOUT_MS
});

clickupRouter.use((_req, res, next) => {
  res.set("x-custom-clickup-read-mode", clickupReadService.getReadMode());
  next();
});

function handleRouteError(error: unknown, res: Response) {
  if (error instanceof ClickUpServiceError) {
    if (typeof error.retryAfterMs === "number") {
      res.set("retry-after", String(Math.ceil(error.retryAfterMs / 1000)));
    }

    res.status(error.statusCode).json({
      message: error.message
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    message: "Unexpected backend error."
  });
}

clickupRouter.get("/schema", async (_req, res) => {
  try {
    res.json({
      schema: await clickupReadService.getSchema(),
      writeMode: config.CLICKUP_WRITE_MODE
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

clickupRouter.get("/planning", async (_req, res) => {
  try {
    res.json({
      items: await clickupReadService.getPlanningItems(),
      writeMode: config.CLICKUP_WRITE_MODE
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

clickupRouter.get("/daily", async (_req, res) => {
  try {
    res.json({
      rows: await clickupReadService.getDailyRows(),
      writeMode: config.CLICKUP_WRITE_MODE
    });
  } catch (error) {
    handleRouteError(error, res);
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
