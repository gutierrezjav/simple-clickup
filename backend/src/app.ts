import cookieParser from "cookie-parser";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { clickupRouter } from "./routes/clickup.js";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/api/clickup", clickupRouter);

  return app;
}
