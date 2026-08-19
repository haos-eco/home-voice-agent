import 'dotenv/config'

import { resolve } from 'node:path'

import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify'

import { verifyCloudflareAccess } from './cloudflare-access.js'
import { config } from './config.js'
import { registerMemoryRoutes } from './fastify-memory-routes.js'
import { verifyInternalSecret } from './internal-auth.js'
import { HomeVoiceMemoryStore } from './memory-store.js'
import {
  createRealtimeCall,
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

async function issueRealtimeToken(_request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  reply.header('Cache-Control', 'no-store, private')

  const startedAt = performance.now()

  try {
    const clientSecret = await createRealtimeClientSecret()

    app.log.info(
      { durationMs: Math.round(performance.now() - startedAt) },
      'Realtime credential created',
    )

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

async function issueRealtimeCall(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  reply.header('Cache-Control', 'no-store, private')

  const body = request.body

  if (!body || typeof body !== 'object' || !('sdp' in body)) {
    return reply.status(400).send({
      error: 'invalid_realtime_offer',
      message: 'A WebRTC SDP offer is required.',
    })
  }

  const sdp = (body as { sdp?: unknown }).sdp

  if (typeof sdp !== 'string' || sdp.length < 32 || sdp.length > 30_000) {
    return reply.status(400).send({
      error: 'invalid_realtime_offer',
      message: 'The WebRTC SDP offer is invalid.',
    })
  }

  const startedAt = performance.now()

  try {
    const call = await createRealtimeCall(sdp)

    app.log.info(
      {
        durationMs: Math.round(performance.now() - startedAt),
        hasLocation: Boolean(call.location),
      },
      'Realtime SDP call created',
    )

    return reply.status(201).send(call)
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
          durationMs: Math.round(performance.now() - startedAt),
        },
        'Failed to create Realtime SDP call',
      )

      return reply.status(502).send({
        error: 'realtime_call_failed',
        message: 'Could not create a Realtime WebRTC call.',
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

app.post(
  '/internal/realtime/call',
  {
    preHandler: [verifyInternalSecret, enforceRealtimeTokenRate],
  },
  issueRealtimeCall,
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

app.setErrorHandler(async (error: FastifyError, _request, reply) => {
  const statusCode =
    typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode <= 599
      ? error.statusCode
      : 500

  if (statusCode >= 500) app.log.error(error)
  else app.log.warn(error)

  return reply.status(statusCode).send({
    error:
      statusCode === 413
        ? 'request_body_too_large'
        : statusCode >= 500
          ? 'internal_server_error'
          : 'request_failed',
    message:
      statusCode === 413
        ? 'The request body exceeds the allowed size.'
        : statusCode >= 500
          ? 'The voice-agent server encountered an unexpected error.'
          : error.message,
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
