import { z } from 'zod'

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value)

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    HOST: z.string().min(1).default('0.0.0.0'),

    PORT: z.coerce.number().int().min(1).max(65_535).default(8787),

    FRONTEND_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform(value =>
        value
          .split(',')
          .map(origin => origin.trim())
          .filter(Boolean),
      ),

    OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(20).optional()),

    OPENAI_SAFETY_USER_ID: z.string().min(1).default('primary-home-user'),

    REALTIME_MODEL: z.string().min(1).default('gpt-realtime'),

    REALTIME_VOICE: z.string().min(1).default('marin'),

    CLOUDFLARE_ACCESS_REQUIRED: z
      .enum(['true', 'false'])
      .default('false')
      .transform(value => value === 'true'),

    CLOUDFLARE_TEAM_DOMAIN: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .url()
        .transform(value => value.replace(/\/$/, ''))
        .optional(),
    ),

    CLOUDFLARE_ACCESS_AUD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  })
  .superRefine((value, context) => {
    if (!value.CLOUDFLARE_ACCESS_REQUIRED) {
      return
    }

    if (!value.CLOUDFLARE_TEAM_DOMAIN) {
      context.addIssue({
        code: 'custom',
        path: ['CLOUDFLARE_TEAM_DOMAIN'],
        message: 'CLOUDFLARE_TEAM_DOMAIN is required when Access is enabled.',
      })
    }

    if (!value.CLOUDFLARE_ACCESS_AUD) {
      context.addIssue({
        code: 'custom',
        path: ['CLOUDFLARE_ACCESS_AUD'],
        message: 'CLOUDFLARE_ACCESS_AUD is required when Access is enabled.',
      })
    }
  })

const result = configSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment configuration:')

  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`)
  }

  process.exit(1)
}

export const config = result.data
