import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type Request } from "express";
import { authRouter } from "./routes/auth.js";
import { clickupRouter } from "./routes/clickup.js";
import { healthRouter } from "./routes/health.js";

export interface AppOptions {
  frontendDistPath?: string;
}

function resolveFrontendDistPath(): string {
  const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
  const candidatePaths = [
    resolve(currentDirectory, "..", "..", "frontend", "dist"),
    resolve(currentDirectory, "..", "..", "..", "..", "frontend", "dist")
  ] as const;

  for (const candidatePath of candidatePaths) {
    if (existsSync(join(candidatePath, "index.html"))) {
      return candidatePath;
    }
  }

  return candidatePaths[0];
}

function shouldServeFrontendIndex(req: Request): boolean {
  if (req.method !== "GET") {
    return false;
  }

  if (extname(req.path)) {
    return false;
  }

  return Boolean(req.accepts("html"));
}

function registerFrontend(app: express.Express, frontendDistPath: string): void {
  const indexPath = join(frontendDistPath, "index.html");
  if (!existsSync(indexPath)) {
    return;
  }

  app.use(express.static(frontendDistPath));

  app.get(/^(?!\/(?:api|auth|health)(?:\/|$)).*/, (req, res, next) => {
    if (!shouldServeFrontendIndex(req)) {
      next();
      return;
    }

    res.sendFile(indexPath);
  });
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const frontendDistPath = options.frontendDistPath ?? resolveFrontendDistPath();

  app.use(express.json());
  app.use(cookieParser());

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/api/clickup", clickupRouter);
  registerFrontend(app, frontendDistPath);

  return app;
}
