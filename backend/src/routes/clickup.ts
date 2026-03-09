import { dailyFixtures, planningFixtures, schemaConfig } from "@custom-clickup/shared";
import { Router } from "express";
import { config } from "../config.js";

export const clickupRouter = Router();

clickupRouter.get("/schema", (_req, res) => {
  res.json({
    schema: schemaConfig,
    writeMode: config.CLICKUP_WRITE_MODE
  });
});

clickupRouter.get("/planning", (_req, res) => {
  res.json({
    items: planningFixtures,
    writeMode: config.CLICKUP_WRITE_MODE
  });
});

clickupRouter.get("/daily", (_req, res) => {
  res.json({
    rows: dailyFixtures,
    writeMode: config.CLICKUP_WRITE_MODE
  });
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
