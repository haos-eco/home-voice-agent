import 'dotenv/config'

import { resolve } from 'node:path'

import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'

import { verifyCloudflareAccess } from './cloudflare-access.js'
import { config } from './config.js'
import { registerMemoryRoutes } from './fastify-memory-routes.js'
import { verifyInternalSecret } from './internal-auth.js'
import { HomeVoiceMemoryStore } from './memory-store.js'
import {
  createRealtimeClientSecret,
  OpenAIConfigurationError,
  OpenAIRealtimeError,
} from './realtime.js'

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  },
  bodyLimit: 32 * 1024,
})

app.decorateRequest('accessIdentity', null)

await app.register(cors, {
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  origin(origin, callback) {
    // Permit curl and other non-browser requests.
    // Authentication is still enforced on protected routes.
    if (!origin) {
      callback(null, true)
      return
    }

    if (config.FRONTEND_ORIGINS.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`Origin not allowed: ${origin}`), false)
  },
})

await app.register(rateLimit, {
  global: false,
})

const checkRealtimeTokenRate = app.createRateLimit({
  max: 6,
  timeWindow: '1 minute',
  keyGenerator(request) {
    const header = request.headers['x-home-assistant-user-id']
    const homeAssistantUserId = Array.isArray(header) ? header[0] : header

    return homeAssistantUserId ?? request.accessIdentity?.sub ?? request.ip
  },
})

async function enforceRealtimeTokenRate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  const limit = await checkRealtimeTokenRate(request)

  if (limit.isAllowed) return

  reply.header('X-RateLimit-Limit', String(limit.max))
  reply.header('X-RateLimit-Remaining', String(Math.max(0, limit.remaining)))
  reply.header('X-RateLimit-Reset', String(limit.ttlInSeconds))

  if (!limit.isExceeded) return

  reply.header('Retry-After', String(Math.max(1, limit.ttlInSeconds)))

  return reply.status(429).send({
    error: 'realtime_token_rate_limited',
    message: 'Too many Realtime sessions were requested. Try again shortly.',
  })
}

async function issueRealtimeToken(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  reply.header('Cache-Control', 'no-store, private')

  try {
    const clientSecret = await createRealtimeClientSecret()
    return reply.status(201).send(clientSecret)
  } catch (error) {
    if (error instanceof OpenAIConfigurationError) {
      return reply.status(503).send({
        error: 'openai_not_configured',
        message: 'The OpenAI API key is not configured.',
      })
    }

    if (error instanceof OpenAIRealtimeError) {
      app.log.error(
        {
          statusCode: error.statusCode,
          error: error.message,
        },
        'Failed to create Realtime credential',
      )

      return reply.status(502).send({
        error: 'realtime_client_secret_failed',
        message: 'Could not create a Realtime credential.',
      })
    }

    throw error
  }
}

const memoryDbPath =
  process.env.HOME_VOICE_MEMORY_DB_PATH?.trim() ||
  (config.NODE_ENV === 'development'
    ? resolve(process.cwd(), 'data', 'memory.db')
    : '/opt/home-voice-agent/data/memory.db')

const memoryStore = new HomeVoiceMemoryStore({
  path: memoryDbPath,
})

app.log.info({ memoryDbPath }, 'Persistent assistant memory initialized')

app.addHook('onClose', async () => {
  memoryStore.close()
})

app.get('/health', async () => ({
  status: 'ok',
  service: 'home-voice-agent-server',
  openaiConfigured: Boolean(config.OPENAI_API_KEY),
  accessRequired: config.CLOUDFLARE_ACCESS_REQUIRED,
  model: config.REALTIME_MODEL,
  timestamp: new Date().toISOString(),
}))

app.post(
  '/api/realtime/token',
  {
    preHandler: [verifyCloudflareAccess, enforceRealtimeTokenRate],
  },
  issueRealtimeToken,
)

app.post(
  '/internal/realtime/token',
  {
    preHandler: [verifyInternalSecret, enforceRealtimeTokenRate],
  },
  issueRealtimeToken,
)

await registerMemoryRoutes(app, {
  store: memoryStore,
  preHandler: verifyInternalSecret,
})

app.setNotFoundHandler(async (_request, reply) =>
  reply.status(404).send({
    error: 'not_found',
  }),
)

app.setErrorHandler(async (error, _request, reply) => {
  app.log.error(error)

  return reply.status(500).send({
    error: 'internal_server_error',
    message: 'The voice-agent server encountered an unexpected error.',
  })
})

async function stop(signal: string): Promise<void> {
  app.log.info({ signal }, 'Stopping voice-agent server')

  try {
    await app.close()
    process.exit(0)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

process.once('SIGINT', () => void stop('SIGINT'))
process.once('SIGTERM', () => void stop('SIGTERM'))

try {
  await app.listen({
    host: config.HOST,
    port: config.PORT,
  })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
