import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { schemaConfig } from "@custom-clickup/shared";
import { z } from "zod";

function parseEnvAssignment(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length)
    : trimmed;
  const separatorIndex = normalized.indexOf("=");

  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!key) {
    return null;
  }

  let value = normalized.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function readEnvFile(filePath: string): Map<string, string> {
  const values = new Map<string, string>();

  if (!existsSync(filePath)) {
    return values;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const assignment = parseEnvAssignment(line);
    if (!assignment) {
      continue;
    }

    const [key, value] = assignment;
    values.set(key, value);
  }

  return values;
}

function loadRepoEnvFiles(): void {
  const directories: string[] = [];
  let directory = process.cwd();

  while (true) {
    directories.push(directory);

    const parentDirectory = dirname(directory);
    if (parentDirectory === directory) {
      break;
    }

    directory = parentDirectory;
  }

  const mergedValues = new Map<string, string>();
  for (const currentDirectory of directories.reverse()) {
    for (const [key, value] of readEnvFile(join(currentDirectory, ".env"))) {
      mergedValues.set(key, value);
    }

    for (const [key, value] of readEnvFile(join(currentDirectory, ".env.local"))) {
      mergedValues.set(key, value);
    }
  }

  for (const [key, value] of mergedValues) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadRepoEnvFiles();

const booleanEnvSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const optionalNonEmptyStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1).optional());

const optionalUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().url().optional());

const optionalSecretSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(16).optional());

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLICKUP_WRITE_MODE: z.enum(["mock", "test-space", "live"]).default("mock"),
  CLICKUP_READ_MODE: z.enum(["mock", "live"]).default("mock"),
  CLICKUP_ACCESS_TOKEN: optionalNonEmptyStringSchema,
  CLICKUP_API_BASE_URL: z.string().url().default("https://api.clickup.com/api/v2"),
  CLICKUP_OAUTH_AUTHORIZE_URL: z.string().url().default("https://app.clickup.com/api"),
  CLICKUP_CLIENT_ID: optionalNonEmptyStringSchema,
  CLICKUP_CLIENT_SECRET: optionalNonEmptyStringSchema,
  CLICKUP_REDIRECT_URI: optionalUrlSchema,
  CLICKUP_TARGET_TEAM_ID: z.string().trim().min(1).default(schemaConfig.workspaceId),
  CLICKUP_TARGET_LIST_ID: z.string().trim().min(1).default(schemaConfig.listId),
  CLICKUP_READ_CACHE_TTL_MS: z.coerce.number().int().positive().default(30_000),
  CLICKUP_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SESSION_SECRET: optionalSecretSchema,
  SESSION_COOKIE_SECURE: booleanEnvSchema.default(false)
}).superRefine((env, ctx) => {
  const oauthFields = [
    "CLICKUP_CLIENT_ID",
    "CLICKUP_CLIENT_SECRET",
    "CLICKUP_REDIRECT_URI",
    "SESSION_SECRET"
  ] as const;
  const hasAnyOAuthConfig = oauthFields.some((fieldName) => Boolean(env[fieldName]));

  if (hasAnyOAuthConfig) {
    for (const fieldName of oauthFields) {
      if (!env[fieldName]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} is required when ClickUp OAuth is configured.`,
          path: [fieldName]
        });
      }
    }
  }
});

export const config = envSchema.parse(process.env);
