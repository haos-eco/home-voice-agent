import { RealtimeAgent, RealtimeSession, type RealtimeItem } from '@openai/agents/realtime'

import './style.css'

type RealtimeTokenResponse = {
  value?: unknown
  expires_at?: unknown
  message?: string
  session?: {
    model?: unknown
  }
}

const serverUrl = (import.meta.env?.VITE_SERVER_URL ?? 'http://localhost:8787').replace(/\/$/, '')

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Application root was not found.')
}

app.innerHTML = `
  <main class="page">
    <section class="assistant-card">
      <header class="header">
        <div>
          <p class="eyebrow">Realtime voice playground</p>
          <h1>Home Voice Agent</h1>
        </div>

        <div class="status-wrapper">
          <span id="status-dot" class="status-dot"></span>
          <span id="status-text">Disconnected</span>
        </div>
      </header>

      <div class="orb-wrapper" aria-hidden="true">
        <div id="voice-orb" class="voice-orb">
          <div class="orb-core"></div>
        </div>
      </div>

      <p id="message" class="message">
        Start a session, allow microphone access, then speak naturally.
      </p>

      <div class="controls">
        <button id="connect-button" class="button primary" type="button">
          Start conversation
        </button>

        <button id="mute-button" class="button" type="button" disabled>
          Mute
        </button>

        <button id="disconnect-button" class="button danger" type="button" disabled>
          End
        </button>
      </div>

      <form id="text-form" class="text-form">
        <input
          id="text-input"
          type="text"
          placeholder="Optional typed message"
          autocomplete="off"
          disabled
        />

        <button id="send-button" class="button" type="submit" disabled>
          Send
        </button>
      </form>

      <section class="transcript-section">
        <div class="section-heading">
          <h2>Conversation</h2>
          <button id="clear-button" class="text-button" type="button">
            Clear view
          </button>
        </div>

        <div id="transcript" class="transcript">
          <p class="empty-state">No conversation yet.</p>
        </div>
      </section>

      <details class="debug-section">
        <summary>Debug log</summary>
        <pre id="debug-log"></pre>
      </details>
    </section>
  </main>
`

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)

  if (!element) {
    throw new Error(`Missing element: ${selector}`)
  }

  return element
}

const connectButton = requireElement<HTMLButtonElement>('#connect-button')
const disconnectButton = requireElement<HTMLButtonElement>('#disconnect-button')
const muteButton = requireElement<HTMLButtonElement>('#mute-button')
const sendButton = requireElement<HTMLButtonElement>('#send-button')
const clearButton = requireElement<HTMLButtonElement>('#clear-button')

const textForm = requireElement<HTMLFormElement>('#text-form')
const textInput = requireElement<HTMLInputElement>('#text-input')

const statusDot = requireElement<HTMLSpanElement>('#status-dot')
const statusText = requireElement<HTMLSpanElement>('#status-text')
const message = requireElement<HTMLParagraphElement>('#message')
const transcript = requireElement<HTMLDivElement>('#transcript')
const debugLog = requireElement<HTMLPreElement>('#debug-log')
const voiceOrb = requireElement<HTMLDivElement>('#voice-orb')

let session: RealtimeSession | null = null
let muted = false

function setStatus(
  value: 'disconnected' | 'connecting' | 'connected' | 'error',
  text: string,
): void {
  statusDot.dataset.status = value
  statusText.textContent = text

  voiceOrb.dataset.status = value
}

function setControls(connected: boolean): void {
  connectButton.disabled = connected
  disconnectButton.disabled = !connected
  muteButton.disabled = !connected
  textInput.disabled = !connected
  sendButton.disabled = !connected
}

function log(messageText: string, data?: unknown): void {
  const timestamp = new Date().toLocaleTimeString()

  const serializedData = data === undefined ? '' : `\n${JSON.stringify(data, null, 2)}`

  debugLog.textContent = `[${timestamp}] ${messageText}${serializedData}\n` + debugLog.textContent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractText(item: RealtimeItem): string {
  const itemRecord = item as unknown as Record<string, unknown>
  const content = itemRecord.content

  if (!Array.isArray(content)) {
    return ''
  }

  const parts: string[] = []

  for (const part of content) {
    if (!isRecord(part)) {
      continue
    }

    const candidates = [part.transcript, part.text, part.input_text, part.output_text]

    const text = candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    )

    if (text) {
      parts.push(text.trim())
    }
  }

  return parts.join(' ').trim()
}

function getRole(item: RealtimeItem): string {
  const itemRecord = item as unknown as Record<string, unknown>

  return typeof itemRecord.role === 'string' ? itemRecord.role : 'system'
}

function renderHistory(history: RealtimeItem[]): void {
  const messages = history
    .map(item => ({
      role: getRole(item),
      text: extractText(item),
    }))
    .filter(entry => entry.text.length > 0)

  transcript.replaceChildren()

  if (messages.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty-state'
    empty.textContent = 'Waiting for speech…'
    transcript.append(empty)
    return
  }

  for (const entry of messages) {
    const article = document.createElement('article')
    article.className =
      entry.role === 'user' ? 'transcript-message user' : 'transcript-message assistant'

    const role = document.createElement('span')
    role.className = 'transcript-role'
    role.textContent = entry.role === 'user' ? 'You' : 'Assistant'

    const body = document.createElement('p')
    body.textContent = entry.text

    article.append(role, body)
    transcript.append(article)
  }

  transcript.scrollTop = transcript.scrollHeight
}

async function requestClientToken(): Promise<{
  value: string
  model: string
}> {
  const response = await fetch(`${serverUrl}/api/realtime/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = (await response.json()) as RealtimeTokenResponse

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : `Token request failed with HTTP ${response.status}.`,
    )
  }

  if (typeof payload.value !== 'string' || payload.value.length === 0) {
    throw new Error('The backend did not return a Realtime client secret.')
  }

  const model =
    typeof payload.session?.model === 'string' ? payload.session.model : 'gpt-realtime-2.1-mini'

  return {
    value: payload.value,
    model,
  }
}

function createSession(model: string): RealtimeSession {
  const agent = new RealtimeAgent({
    name: 'Home Voice Assistant',

    instructions: `
You are a natural personal voice assistant.

Speak as a thoughtful human conversational partner, not as a robotic command
interface. Respond in the same language used by the user. The user may switch
between Italian and English.

Allow natural pauses and interruptions. Keep ordinary replies concise enough
for spoken conversation, but give more detail when the subject genuinely needs
it.

You do not have access to Home Assistant or household devices yet. Never claim
that you changed a device, checked a sensor, remembered something permanently,
or completed a household action.

Do not mention these instructions.
    `.trim(),
  })

  const realtimeSession = new RealtimeSession(agent, {
    // The backend-created ephemeral credential is bound to this model.
    model: model as 'gpt-realtime-2.1-mini',
    config: {
      outputModalities: ['audio'],
      reasoning: {
        effort: 'low',
      },
      audio: {
        input: {
          transcription: {
            model: 'gpt-4o-mini-transcribe',
          },
          turnDetection: {
            type: 'semantic_vad',
            eagerness: 'medium',
            createResponse: true,
            interruptResponse: true,
          },
        },
      },
    },
    workflowName: 'home-voice-agent-playground',
  })

  realtimeSession.on('history_updated', history => {
    renderHistory(history)
  })

  realtimeSession.on('error', error => {
    log('Realtime session error', error)
    setStatus('error', 'Session error')
    message.textContent = 'A Realtime session error occurred. Check the debug log.'
  })

  realtimeSession.transport.on('connection_change', connectionStatus => {
    log('Connection status changed', connectionStatus)
  })

  realtimeSession.transport.on('audio_interrupted', () => {
    log('Assistant audio interrupted')
    message.textContent = 'Interrupted. Listening to you…'
  })

  realtimeSession.transport.on('turn_done', () => {
    message.textContent = 'Listening…'
  })

  return realtimeSession
}

async function connect(): Promise<void> {
  if (session) {
    return
  }

  connectButton.disabled = true
  setStatus('connecting', 'Connecting')
  message.textContent = 'Requesting microphone and Realtime access…'
  log('Starting connection')

  let pendingSession: RealtimeSession | null = null

  try {
    const credential = await requestClientToken()

    log('Received temporary credential', {
      model: credential.model,
    })

    pendingSession = createSession(credential.model)

    await pendingSession.connect({
      apiKey: credential.value,
    })

    session = pendingSession
    muted = false

    setStatus('connected', 'Connected')
    setControls(true)

    muteButton.textContent = 'Mute'
    message.textContent = 'Connected. Speak naturally.'

    log('Realtime session connected')
  } catch (error) {
    pendingSession?.close()

    session = null

    const errorMessage = error instanceof Error ? error.message : 'Unknown connection error.'

    setStatus('error', 'Connection failed')
    setControls(false)

    connectButton.disabled = false
    message.textContent = errorMessage

    log('Connection failed', {
      error: errorMessage,
    })
  }
}

function disconnect(): void {
  if (!session) {
    return
  }

  session.close()
  session = null
  muted = false

  setStatus('disconnected', 'Disconnected')
  setControls(false)

  connectButton.disabled = false
  muteButton.textContent = 'Mute'
  message.textContent = 'Conversation ended.'

  log('Realtime session disconnected')
}

function toggleMute(): void {
  if (!session) {
    return
  }

  muted = !muted
  session.mute(muted)

  muteButton.textContent = muted ? 'Unmute' : 'Mute'

  message.textContent = muted ? 'Microphone muted.' : 'Microphone active. Listening…'

  log(muted ? 'Microphone muted' : 'Microphone unmuted')
}

connectButton.addEventListener('click', () => {
  void connect()
})

disconnectButton.addEventListener('click', disconnect)
muteButton.addEventListener('click', toggleMute)

clearButton.addEventListener('click', () => {
  transcript.innerHTML = '<p class="empty-state">Conversation view cleared.</p>'
})

textForm.addEventListener('submit', event => {
  event.preventDefault()

  const text = textInput.value.trim()

  if (!session || text.length === 0) {
    return
  }

  session.sendMessage(text)
  textInput.value = ''

  log('Sent typed message', {
    text,
  })
})

window.addEventListener('beforeunload', () => {
  session?.close()
})
