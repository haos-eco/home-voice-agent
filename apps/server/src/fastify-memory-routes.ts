import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify'

import {
  HomeVoiceMemoryStore,
  type AliasObservation,
  type PreferenceObservation,
} from './memory-store.js'

type MemoryPreHandler = preHandlerHookHandler

export type RegisterMemoryRoutesOptions = {
  store: HomeVoiceMemoryStore
  preHandler: MemoryPreHandler
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function badRequest(reply: FastifyReply, error: unknown): FastifyReply {
  return reply.status(400).send({
    error: 'invalid_memory_request',
    message: errorMessage(error),
  })
}

export async function registerMemoryRoutes(
  app: FastifyInstance,
  options: RegisterMemoryRoutesOptions,
): Promise<void> {
  const protectedRoute = {
    preHandler: options.preHandler,
  }

  app.get('/internal/memory/context', protectedRoute, async (request, reply) => {
    try {
      const query = request.query as { trusted_only?: string } | undefined

      return {
        ok: true,
        ...options.store.getContext({
          includeLowConfidence: query?.trusted_only !== '1',
        }),
      }
    } catch (error) {
      return badRequest(reply, error)
    }
  })

  app.get('/internal/memory/diagnostics', protectedRoute, async (_request, reply) => {
    try {
      return options.store.diagnostics()
    } catch (error) {
      app.log.error({ error }, 'Memory diagnostics failed')
      return reply.status(500).send({
        error: 'memory_diagnostics_failed',
        message: 'Could not inspect persistent memory.',
      })
    }
  })

  app.post('/internal/memory/alias/observe', protectedRoute, async (request, reply) => {
    try {
      return options.store.observeAlias(request.body as AliasObservation)
    } catch (error) {
      return badRequest(reply, error)
    }
  })

  app.post('/internal/memory/preference/observe', protectedRoute, async (request, reply) => {
    try {
      return options.store.observePreference(request.body as PreferenceObservation)
    } catch (error) {
      return badRequest(reply, error)
    }
  })

  app.post('/internal/memory/catalog/reconcile', protectedRoute, async (request, reply) => {
    try {
      const body = (request.body ?? {}) as {
        entity_ids?: unknown
        at?: number
      }

      return options.store.reconcileCatalog({
        entity_ids: Array.isArray(body.entity_ids)
          ? body.entity_ids.filter((value): value is string => typeof value === 'string')
          : (body.entity_ids as string[]),
        at: body.at,
      })
    } catch (error) {
      return badRequest(reply, error)
    }
  })

  app.post(
    '/internal/memory/import',
    {
      ...protectedRoute,
      bodyLimit: 256 * 1024,
    },
    async (request, reply) => {
      try {
        const body = (request.body ?? {}) as {
          aliases?: unknown[]
          preferences?: unknown[]
          source_device?: string | null
        }

        return options.store.importLegacyStore(body)
      } catch (error) {
        return badRequest(reply, error)
      }
    },
  )
}
