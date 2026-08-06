import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  HOST: z.string().min(1).default("0.0.0.0"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .default(8787),

  FRONTEND_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  OPENAI_API_KEY: z
    .string()
    .min(20)
    .optional()
    .or(z.literal("").transform(() => undefined)),

  OPENAI_SAFETY_USER_ID: z
    .string()
    .min(1)
    .default("primary-home-user"),

  REALTIME_MODEL: z
    .string()
    .min(1)
    .default("gpt-realtime-2.1-mini"),

  REALTIME_VOICE: z
    .string()
    .min(1)
    .default("marin"),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");

  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }

  process.exit(1);
}

export const config = result.data;
