import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLICKUP_WRITE_MODE: z.enum(["mock", "test-space", "live"]).default("mock")
});

export const config = envSchema.parse(process.env);
