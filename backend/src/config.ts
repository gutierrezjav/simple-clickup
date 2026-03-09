import { schemaConfig } from "@custom-clickup/shared";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLICKUP_WRITE_MODE: z.enum(["mock", "test-space", "live"]).default("mock"),
  CLICKUP_READ_MODE: z.enum(["mock", "live"]).default("mock"),
  CLICKUP_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  CLICKUP_API_BASE_URL: z.string().url().default("https://api.clickup.com/api/v2"),
  CLICKUP_TARGET_TEAM_ID: z.string().trim().min(1).default(schemaConfig.workspaceId),
  CLICKUP_TARGET_LIST_ID: z.string().trim().min(1).default(schemaConfig.listId),
  CLICKUP_READ_CACHE_TTL_MS: z.coerce.number().int().positive().default(30_000),
  CLICKUP_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000)
}).superRefine((env, ctx) => {
  if (env.CLICKUP_READ_MODE === "live" && !env.CLICKUP_ACCESS_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CLICKUP_ACCESS_TOKEN is required when CLICKUP_READ_MODE=live.",
      path: ["CLICKUP_ACCESS_TOKEN"]
    });
  }
});

export const config = envSchema.parse(process.env);
