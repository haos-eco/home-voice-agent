import type { FastifyReply, FastifyRequest } from 'fastify'
import { createRemoteJWKSet, jwtVerify } from 'jose'

import { config } from './config.js'

export type AccessIdentity = {
  sub: string
  email?: string
}

const cloudflareJwks = config.CLOUDFLARE_TEAM_DOMAIN
  ? createRemoteJWKSet(new URL(`${config.CLOUDFLARE_TEAM_DOMAIN}/cdn-cgi/access/certs`))
  : null

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function verifyCloudflareAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  if (!config.CLOUDFLARE_ACCESS_REQUIRED) {
    request.accessIdentity = {
      sub: 'local-development',
    }

    return
  }

  const token = readHeader(request.headers['cf-access-jwt-assertion'])

  if (
    !token ||
    !cloudflareJwks ||
    !config.CLOUDFLARE_TEAM_DOMAIN ||
    !config.CLOUDFLARE_ACCESS_AUD
  ) {
    return reply.status(401).send({
      error: 'access_authentication_required',
      message: 'A valid Cloudflare Access session is required.',
    })
  }

  try {
    const { payload } = await jwtVerify(token, cloudflareJwks, {
      issuer: config.CLOUDFLARE_TEAM_DOMAIN,
      audience: config.CLOUDFLARE_ACCESS_AUD,
    })

    if (typeof payload.sub !== 'string') {
      throw new Error('Cloudflare Access token has no subject.')
    }

    const identity: AccessIdentity = {
      sub: payload.sub,
    }

    if (typeof payload.email === 'string') {
      identity.email = payload.email
    }

    request.accessIdentity = identity
  } catch (error) {
    request.log.warn(
      {
        error: error instanceof Error ? error.message : 'Unknown JWT verification error',
      },
      'Rejected invalid Cloudflare Access assertion',
    )

    return reply.status(401).send({
      error: 'invalid_access_assertion',
      message: 'The Cloudflare Access session is invalid.',
    })
  }
}
