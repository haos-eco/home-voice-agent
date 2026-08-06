import { createHash } from 'node:crypto'

import { config } from './config.js'

const OPENAI_CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

export class OpenAIConfigurationError extends Error {
  constructor() {
    super('OpenAI API key is not configured.')
    this.name = 'OpenAIConfigurationError'
  }
}

export class OpenAIRealtimeError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'OpenAIRealtimeError'
    this.statusCode = statusCode
  }
}

function createSafetyIdentifier(): string {
  return createHash('sha256').update(config.OPENAI_SAFETY_USER_ID).digest('hex')
}

export async function createRealtimeClientSecret(): Promise<unknown> {
  if (!config.OPENAI_API_KEY) {
    throw new OpenAIConfigurationError()
  }

  const response = await fetch(OPENAI_CLIENT_SECRETS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createSafetyIdentifier(),
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: config.REALTIME_MODEL,
        audio: {
          output: {
            voice: config.REALTIME_VOICE,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  const responseText = await response.text()

  if (!response.ok) {
    // Loggable error without leaking the permanent API key.
    throw new OpenAIRealtimeError(
      `OpenAI returned HTTP ${response.status}: ${responseText}`,
      response.status,
    )
  }

  try {
    return JSON.parse(responseText) as unknown
  } catch {
    throw new OpenAIRealtimeError('OpenAI returned an invalid JSON response.', 502)
  }
}
