import { timingSafeEqual } from 'node:crypto'

import type { FastifyReply, FastifyRequest } from 'fastify'

import { config } from './config.js'

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function secureEquals(supplied: string, expected: string): boolean {
  const suppliedBuffer = Buffer.from(supplied, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')

  if (suppliedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(suppliedBuffer, expectedBuffer)
}

export async function verifyInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  const suppliedSecret = readHeader(request.headers['x-home-voice-secret'])

  if (
    !config.INTERNAL_API_SECRET ||
    !suppliedSecret ||
    !secureEquals(suppliedSecret, config.INTERNAL_API_SECRET)
  ) {
    request.log.warn(
      {
        ip: request.ip,
      },
      'Rejected invalid internal authentication',
    )

    return reply.status(401).send({
      error: 'invalid_internal_authentication',
      message: 'Valid internal authentication is required.',
    })
  }
}
