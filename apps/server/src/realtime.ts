import { createHash } from 'node:crypto'

import { config } from './config.js'

const OPENAI_CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'
const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

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

export type RealtimeCallResult = {
  sdp: string
  location: string | null
  model: string
}

function createSafetyIdentifier(): string {
  return createHash('sha256').update(config.OPENAI_SAFETY_USER_ID).digest('hex')
}

function requireOpenAIKey(): string {
  if (!config.OPENAI_API_KEY) {
    throw new OpenAIConfigurationError()
  }

  return config.OPENAI_API_KEY
}

function baseRealtimeSessionConfig(): Record<string, unknown> {
  return {
    type: 'realtime',
    model: config.REALTIME_MODEL,
    audio: {
      output: {
        voice: config.REALTIME_VOICE,
      },
    },
  }
}

export async function createRealtimeClientSecret(): Promise<unknown> {
  const apiKey = requireOpenAIKey()

  const response = await fetch(OPENAI_CLIENT_SECRETS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createSafetyIdentifier(),
    },
    body: JSON.stringify({
      session: baseRealtimeSessionConfig(),
    }),
    signal: AbortSignal.timeout(15_000),
  })

  const responseText = await response.text()

  if (!response.ok) {
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

export async function createRealtimeCall(sdpOffer: string): Promise<RealtimeCallResult> {
  const apiKey = requireOpenAIKey()

  const form = new FormData()
  form.append(
    'sdp',
    new Blob([sdpOffer], { type: 'application/sdp' }),
    'offer.sdp',
  )
  form.append(
    'session',
    new Blob([JSON.stringify(baseRealtimeSessionConfig())], { type: 'application/json' }),
    'session.json',
  )

  const response = await fetch(OPENAI_REALTIME_CALLS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Safety-Identifier': createSafetyIdentifier(),
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  })

  const answer = await response.text()

  if (!response.ok) {
    throw new OpenAIRealtimeError(
      `OpenAI returned HTTP ${response.status}: ${answer}`,
      response.status,
    )
  }

  if (!answer.trim()) {
    throw new OpenAIRealtimeError('OpenAI returned an empty SDP answer.', 502)
  }

  return {
    sdp: answer,
    location: response.headers.get('location'),
    model: config.REALTIME_MODEL,
  }
}
