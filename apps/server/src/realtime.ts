import { createHash, randomUUID } from 'node:crypto'

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

function buildRealtimeCallMultipart(sdpOffer: string): {
  boundary: string
  body: Uint8Array
} {
  const boundary = `----home-voice-agent-${randomUUID()}`
  const session = JSON.stringify(baseRealtimeSessionConfig())

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="sdp"\r\n' +
        'Content-Type: application/sdp\r\n\r\n',
      'utf8',
    ),
    Buffer.from(sdpOffer, 'utf8'),
    Buffer.from(
      `\r\n--${boundary}\r\n` +
        'Content-Disposition: form-data; name="session"\r\n' +
        'Content-Type: application/json\r\n\r\n' +
        session +
        `\r\n--${boundary}--\r\n`,
      'utf8',
    ),
  ])

  return {
    boundary,
    body: new Uint8Array(body),
  }
}

export async function createRealtimeCall(sdpOffer: string): Promise<RealtimeCallResult> {
  const apiKey = requireOpenAIKey()
  const multipart = buildRealtimeCallMultipart(sdpOffer)

  const response = await fetch(OPENAI_REALTIME_CALLS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Safety-Identifier': createSafetyIdentifier(),
      'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
    },
    body: multipart.body,
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
