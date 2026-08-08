import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  type OpenAIRealtimeModels,
} from '@openai/agents/realtime'

export type VoiceAgentState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

export type VoiceAgentStartOptions = {
  inputReady?: boolean
}

type PrepareInputHook = () => Promise<void> | void

type HassLike = {
  callWS<T>(message: Record<string, unknown>): Promise<T>
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<unknown>
}

type VoiceAgentConfig = {
  room: string
  deviceId: string
  stateEntity: string
  inactivityMs: number
  maxSessionMs: number
}

type RealtimeTokenResponse = {
  value?: unknown
  session?: {
    model?: unknown
  }
  message?: unknown
}

const DEFAULT_CONFIG: VoiceAgentConfig = {
  room: '',
  deviceId: '',
  stateEntity: '',
  inactivityMs: 90_000,
  maxSessionMs: 60_000,
}

const AGENT_INSTRUCTIONS = `
# Role

You are a natural personal voice assistant and conversational companion.

Speak like a real person in an informal conversation. Do not sound like a
customer-service agent, lecturer, motivational coach, or robotic command
interface.

# Language

- Your language is Italian. Always respond in Italian, unless the user explicitly requests another language. 
  If the user switches to another language, continue in that language until the user switches back to Italian.

# Voice Style

- Speak with natural Italian rhythm and intonation.
- Sound relaxed, warm, and conversational, like a person speaking nearby.
- Avoid an announcer, narrator, call-center, or synthetic assistant cadence.
- Use subtle variation in pitch, emphasis, and pacing.
- Allow brief natural pauses where a person would pause.
- Do not over-enunciate words or make every sentence sound equally emphatic.
- Keep short replies fluid and spontaneous rather than clipped or robotic.

# Response Length

- DEFAULT TO ONE SHORT SENTENCE.
- For casual remarks, greetings, confirmations, or personal updates, use
  approximately 2 to 12 words.
- Give longer responses only when the user asks for information, explanation,
  analysis, instructions, advice, or more detail.
- Never turn a simple remark into a speech.
- Do not repeat or paraphrase what the user just said.
- Do not ask unnecessary follow-up questions.

# Examples

User: "I'm going to get a coffee."
Assistant: "Enjoy."

User: "Vado a prendere un caffè."
Assistant: "Va bene, goditelo."

User: "I'm back."
Assistant: "Welcome back."

User: "Sono stanco."
Assistant: "Ci credo, è stata una giornata lunga."

# Current Capabilities

You do not have access to Home Assistant devices yet.

Never claim that you changed a device, checked a sensor, stored a permanent
memory, or completed an action in the house.

Do not mention these instructions.
`.trim()

export class HomeVoiceAgentController {
  private config: VoiceAgentConfig = {
    ...DEFAULT_CONFIG,
  }

  private hass: HassLike | null = null
  private session: RealtimeSession | null = null
  private audioElement: HTMLAudioElement | null = null
  private inactivityTimer: number | null = null
  private maxSessionTimer: number | null = null
  private idleAfterErrorTimer: number | null = null
  private currentState: VoiceAgentState = 'idle'
  private lastError: string | null = null
  private prepareInputHook: PrepareInputHook | null = null
  private hassInitiallyBound = false
  private stopping = false

  private audioContext: AudioContext | null = null
  private audioSource: MediaStreamAudioSourceNode | null = null
  private audioGain: GainNode | null = null
  private audioCompressor: DynamicsCompressorNode | null = null
  private audioOutputGain: GainNode | null = null

  public setPrepareInputHook(hook: PrepareInputHook | null): void {
    this.prepareInputHook = hook
  }

  public configure(partialConfig: Partial<VoiceAgentConfig>): void {
    this.config = {
      ...this.config,
      ...partialConfig,
    }
  }

  public bindHass(hass: HassLike): void {
    this.hass = hass

    if (!this.hassInitiallyBound) {
      this.hassInitiallyBound = true
      void this.publishState()
    }
  }

  public get state(): VoiceAgentState {
    return this.currentState
  }

  public async toggle(): Promise<void> {
    if (this.session) {
      this.stop()
      return
    }

    await this.start()
  }

  public async start(options: VoiceAgentStartOptions = {}): Promise<void> {
    this.lastError = null

    if (this.session || this.currentState === 'connecting') {
      return
    }

    this.clearErrorTimer()
    this.setState('connecting')

    try {
      if (!options.inputReady && this.prepareInputHook) {
        await this.prepareInputHook()
      }

      const credential = await this.requestClientCredential()

      const audioElement = document.createElement('audio')
      audioElement.autoplay = true

      const transport = new OpenAIRealtimeWebRTC({
        audioElement,
      })

      const agent = new RealtimeAgent({
        name: 'Dona',
        voice: 'marin',
        instructions: AGENT_INSTRUCTIONS,
      })

      const session = new RealtimeSession(agent, {
        transport,
        model: credential.model as OpenAIRealtimeModels,
        config: {
          outputModalities: ['audio'],
          reasoning: {
            effort: 'medium',
          },
          audio: {
            input: {
              noiseReduction: {
                type: 'far_field',
              },
              turnDetection: {
                type: 'semantic_vad',
                eagerness: 'medium',
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: {
              voice: 'marin',
              speed: 0.96,
            },
          },
        },
        workflowName: 'home-voice-agent',
      })

      this.session = session
      this.audioElement = audioElement

      session.transport.on('connection_change', connectionState => {
        if (connectionState === 'connected') {
          void this.setupBoostedAudio(audioElement)
          this.setState('listening')
          this.resetInactivityTimer()
          this.startMaxSessionTimer()
          return
        }

        if (connectionState === 'disconnected' && !this.stopping && this.session === session) {
          this.releaseSession()
          this.setState('idle')
        }
      })

      session.transport.on('turn_started', () => {
        this.setState('speaking')
        this.resetInactivityTimer()
      })

      session.transport.on('turn_done', () => {
        this.setState('listening')
        this.resetInactivityTimer()
      })

      session.transport.on('audio_interrupted', () => {
        this.setState('listening')
        this.resetInactivityTimer()
      })

      session.transport.on('*', event => {
        if (
          event &&
          typeof event === 'object' &&
          'type' in event &&
          event.type === 'input_audio_buffer.speech_started'
        ) {
          this.setState('listening')
          this.resetInactivityTimer()
        }
      })

      session.on('error', error => {
        console.error('[Home Voice Agent] Realtime error', error)

        this.handleError(error)
      })

      await session.connect({
        apiKey: credential.value,
      })
    } catch (error) {
      console.error('[Home Voice Agent] Connection failed', error)

      this.handleError(error)
    }
  }

  public stop(): void {
    this.stopping = true

    this.clearInactivityTimer()
    this.clearErrorTimer()
    this.releaseSession()

    this.setState('idle')
    this.stopping = false
  }

  public interrupt(): void {
    this.session?.interrupt()
  }

  /**
   * Returns an animated, theme-aware glass SVG data URL for navbar-card.
   */
  public icon(requestedState?: string): string {
    const state = this.isVoiceAgentState(requestedState) ? requestedState : this.currentState

    return this.svgDataUrl(this.createIconSvg(state))
  }

  public diagnostics() {
    return {
      state: this.currentState,
      error: this.lastError,
      hasHass: Boolean(this.hass),
      hasSession: Boolean(this.session),
      room: this.config.room,
      deviceId: this.config.deviceId,
      stateEntity: this.config.stateEntity,
      inactivityMs: this.config.inactivityMs,
      maxSessionMs: this.config.maxSessionMs,
      maxSessionTimerActive: this.maxSessionTimer !== null,
    }
  }

  private async requestClientCredential(): Promise<{
    value: string
    model: string
  }> {
    if (!this.hass) {
      throw new Error('Home Assistant is not connected.')
    }

    const payload = await this.hass.callWS<RealtimeTokenResponse>({
      type: 'home_voice_agent/realtime_token',
    })

    if (typeof payload.value !== 'string' || payload.value.length === 0) {
      const message =
        typeof payload.message === 'string'
          ? payload.message
          : 'Home Assistant returned no Realtime credential.'

      throw new Error(message)
    }

    return {
      value: payload.value,
      model:
        typeof payload.session?.model === 'string' ? payload.session.model : 'gpt-realtime-2.1',
    }
  }

  private setState(state: VoiceAgentState): void {
    if (state === this.currentState) {
      return
    }

    this.currentState = state

    window.dispatchEvent(
      new CustomEvent('home-voice-agent-state-changed', {
        detail: {
          state,
          room: this.config.room,
          deviceId: this.config.deviceId,
        },
      }),
    )

    void this.publishState()
  }

  private async publishState(): Promise<void> {
    if (!this.hass || !this.config.stateEntity) {
      return
    }

    try {
      await this.hass.callService('input_select', 'select_option', {
        entity_id: this.config.stateEntity,
        option: this.currentState,
      })
    } catch (error) {
      console.warn('[Home Voice Agent] Could not publish state', error)
    }
  }

  private resetInactivityTimer(): void {
    this.clearInactivityTimer()

    this.inactivityTimer = window.setTimeout(() => {
      console.info('[Home Voice Agent] Closing inactive session')

      this.stop()
    }, this.config.inactivityMs)
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer === null) {
      return
    }

    window.clearTimeout(this.inactivityTimer)
    this.inactivityTimer = null
  }

  private startMaxSessionTimer(): void {
    this.clearMaxSessionTimer()

    this.maxSessionTimer = window.setTimeout(() => {
      this.maxSessionTimer = null
      console.info('[Home Voice Agent] Maximum session duration reached')

      this.stop()
    }, this.config.maxSessionMs)
  }

  private clearMaxSessionTimer(): void {
    if (this.maxSessionTimer === null) {
      return
    }

    window.clearTimeout(this.maxSessionTimer)
    this.maxSessionTimer = null
  }

  private clearErrorTimer(): void {
    if (this.idleAfterErrorTimer === null) return
    window.clearTimeout(this.idleAfterErrorTimer)
    this.idleAfterErrorTimer = null
  }

  private handleError(error?: unknown): void {
    this.lastError =
      error instanceof Error ? error.message : error ? String(error) : 'Unknown voice-agent error'

    console.error('[Home Voice Agent]', this.lastError, error)

    this.clearInactivityTimer()
    this.releaseSession()
    this.setState('error')

    this.idleAfterErrorTimer = window.setTimeout(() => {
      this.idleAfterErrorTimer = null

      if (this.currentState === 'error') {
        this.setState('idle')
      }
    }, 8_000)
  }

  private releaseSession(): void {
    this.clearMaxSessionTimer()

    const session = this.session
    const audioElement = this.audioElement
    const audioContext = this.audioContext

    this.session = null
    this.audioElement = null

    this.audioContext = null
    this.audioSource = null
    this.audioGain = null
    this.audioCompressor = null
    this.audioOutputGain = null

    try {
      session?.close()
    } catch (error) {
      console.warn('[Home Voice Agent] Error closing session', error)
    }

    if (audioElement) {
      audioElement.pause()
      audioElement.srcObject = null
      audioElement.removeAttribute('src')
    }

    if (audioContext) {
      void audioContext.close().catch(error => {
        console.warn('[Home Voice Agent] Error closing audio context', error)
      })
    }
  }

  private isVoiceAgentState(value: unknown): value is VoiceAgentState {
    return (
      value === 'idle' ||
      value === 'connecting' ||
      value === 'listening' ||
      value === 'speaking' ||
      value === 'error'
    )
  }

  private themeVar(name: string, fallback: string): string {
    const root = document.querySelector('home-assistant') ?? document.documentElement
    const value = getComputedStyle(root).getPropertyValue(name).trim()
    return value || fallback
  }

  private svgDataUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  private createIconSvg(state: VoiceAgentState): string {
    const primary = this.themeVar('--primary-color', '#7c8cff')
    const accent = this.themeVar('--accent-color', primary)
    const text = this.themeVar('--primary-text-color', '#ffffff')
    const secondary = this.themeVar('--secondary-text-color', '#a9b2c3')
    const card = this.themeVar('--card-background-color', '#111722')
    const success = this.themeVar('--success-color', '#4fd18b')
    const errorColor = this.themeVar('--error-color', '#ff6178')

    const speaking = state === 'speaking'
    const listening = state === 'listening'
    const connecting = state === 'connecting'
    const error = state === 'error'
    const active = speaking || listening || connecting

    const stateColor = error
      ? errorColor
      : speaking
        ? success
        : listening
          ? accent
          : connecting
            ? primary
            : accent

    const haloColor = speaking ? success : error ? errorColor : accent
    const pulseDuration = speaking ? '1.05s' : listening ? '1.45s' : connecting ? '1.2s' : '5.5s'

    const idleWave = `
      <ellipse cx="50" cy="50" rx="7.5" ry="7.5" fill="#ffffff" fill-opacity=".09"/>
      <circle cx="50" cy="50" r="3.6" fill="${text}" fill-opacity=".94"/>
    `

    const listeningWave = `
      <path
        d="M27 50
           C33 46, 37 44, 42 50
           C46 55, 50 57, 54 50
           C58 44, 63 46, 73 50"
        fill="none"
        stroke="${text}"
        stroke-width="3.1"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity=".96"
      >
        <animate
          attributeName="d"
          dur="1.3s"
          repeatCount="indefinite"
          values="
            M27 50 C33 46, 37 44, 42 50 C46 55, 50 57, 54 50 C58 44, 63 46, 73 50;
            M27 50 C33 43, 37 40, 42 50 C46 60, 50 62, 54 50 C58 40, 63 43, 73 50;
            M27 50 C33 47, 37 46, 42 50 C46 53, 50 55, 54 50 C58 46, 63 47, 73 50;
            M27 50 C33 46, 37 44, 42 50 C46 55, 50 57, 54 50 C58 44, 63 46, 73 50
          "
        />
      </path>
    `

    const speakingWave = `
      <path
        d="M24 50
           C30 50, 33 38, 38 38
           C43 38, 44 61, 49 61
           C54 61, 55 33, 61 33
           C66 33, 67 66, 72 66
           C76 66, 78 48, 82 48"
        fill="none"
        stroke="${text}"
        stroke-width="3.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity=".98"
      >
        <animate
          attributeName="d"
          dur=".92s"
          repeatCount="indefinite"
          values="
            M24 50 C30 50, 33 38, 38 38 C43 38, 44 61, 49 61 C54 61, 55 33, 61 33 C66 33, 67 66, 72 66 C76 66, 78 48, 82 48;
            M24 50 C30 50, 33 44, 38 44 C43 44, 44 56, 49 56 C54 56, 55 40, 61 40 C66 40, 67 59, 72 59 C76 59, 78 49, 82 49;
            M24 50 C30 50, 33 34, 38 34 C43 34, 44 64, 49 64 C54 64, 55 28, 61 28 C66 28, 67 71, 72 71 C76 71, 78 46, 82 46;
            M24 50 C30 50, 33 38, 38 38 C43 38, 44 61, 49 61 C54 61, 55 33, 61 33 C66 33, 67 66, 72 66 C76 66, 78 48, 82 48
          "
        />
      </path>
    `

    const connectingWave = `
      <g fill="${text}" opacity=".95">
        <circle cx="40" cy="50" r="3.2">
          <animate attributeName="opacity" values=".25;1;.25" dur="1s" repeatCount="indefinite"/>
        </circle>
        <circle cx="50" cy="50" r="3.2">
          <animate attributeName="opacity" values=".25;1;.25" dur="1s" begin=".16s" repeatCount="indefinite"/>
        </circle>
        <circle cx="60" cy="50" r="3.2">
          <animate attributeName="opacity" values=".25;1;.25" dur="1s" begin=".32s" repeatCount="indefinite"/>
        </circle>
      </g>
    `

    const errorWave = `
      <g stroke="${text}" stroke-width="3.6" stroke-linecap="round" opacity=".96">
        <path d="M42 42 L58 58"/>
        <path d="M58 42 L42 58"/>
      </g>
    `

    const stateVisual = error
      ? errorWave
      : speaking
        ? speakingWave
        : listening
          ? listeningWave
          : connecting
            ? connectingWave
            : idleWave

    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-10 -10 120 120"
        overflow="visible"
      >
        <defs>
          <radialGradient id="hva-v2-core" cx="50%" cy="42%" r="58%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity=".22"/>
            <stop offset="28%" stop-color="${stateColor}" stop-opacity=".26"/>
            <stop offset="60%" stop-color="${card}" stop-opacity=".14"/>
            <stop offset="100%" stop-color="${card}" stop-opacity="0"/>
          </radialGradient>

          <radialGradient id="hva-v2-orb" cx="36%" cy="32%" r="74%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity=".24"/>
            <stop offset="14%" stop-color="${haloColor}" stop-opacity=".28"/>
            <stop offset="48%" stop-color="${card}" stop-opacity=".24"/>
            <stop offset="100%" stop-color="${card}" stop-opacity=".10"/>
          </radialGradient>

          <linearGradient id="hva-v2-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${accent}"/>
            <stop offset="50%" stop-color="${stateColor}"/>
            <stop offset="100%" stop-color="${primary}"/>
          </linearGradient>

          <filter id="hva-v2-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
            />
          </filter>

          <filter id="hva-v2-soft-shadow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#000000" flood-opacity=".22"/>
          </filter>
        </defs>

        <g filter="url(#hva-v2-glow)">
          <circle cx="50" cy="50" r="38" fill="${haloColor}" opacity="${active ? '.16' : '.10'}">
            <animate
              attributeName="r"
              values="${active ? '35;42;37;44;35' : '36;39;36'}"
              dur="${pulseDuration}"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="${active ? '.14;.28;.16;.30;.14' : '.08;.15;.08'}"
              dur="${pulseDuration}"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="50" cy="50" r="26" fill="${haloColor}" opacity="${active ? '.12' : '.06'}">
            <animate
              attributeName="r"
              values="${active ? '24;30;25;31;24' : '25;27;25'}"
              dur="${pulseDuration}"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        <g filter="url(#hva-v2-soft-shadow)">
          <circle cx="50" cy="50" r="31" fill="url(#hva-v2-orb)"/>
          <circle cx="50" cy="50" r="24.5" fill="url(#hva-v2-core)"/>

          <ellipse
            cx="40"
            cy="35"
            rx="15"
            ry="8"
            fill="#ffffff"
            opacity=".13"
            transform="rotate(-18 40 35)"
          />

          <circle
            cx="50"
            cy="50"
            r="29"
            fill="none"
            stroke="url(#hva-v2-ring)"
            stroke-width="2.2"
            stroke-opacity="${error ? '.95' : '.84'}"
          >
            <animate
              attributeName="r"
              values="${active ? '28;30.5;29;31;28' : '28.5;29.5;28.5'}"
              dur="${pulseDuration}"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-opacity"
              values="${active ? '.82;1;.80;1;.82' : '.64;.82;.64'}"
              dur="${pulseDuration}"
              repeatCount="indefinite"
            />
          </circle>

          <circle
            cx="50"
            cy="50"
            r="20"
            fill="none"
            stroke="#ffffff"
            stroke-opacity=".08"
            stroke-width="1"
          />

          <g>
            ${stateVisual}
          </g>
        </g>

        ${
          connecting
            ? `
              <circle
                cx="50"
                cy="50"
                r="39"
                fill="none"
                stroke="${primary}"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-dasharray="18 226"
                opacity=".7"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 50 50"
                  to="360 50 50"
                  dur=".95s"
                  repeatCount="indefinite"
                />
              </circle>
            `
            : ''
        }
      </svg>
    `
  }

  private async setupBoostedAudio(audioElement: HTMLAudioElement): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (audioElement.srcObject instanceof MediaStream) {
        break
      }

      await new Promise(resolve => window.setTimeout(resolve, 100))
    }

    const srcObject = audioElement.srcObject

    if (!(srcObject instanceof MediaStream)) {
      console.warn('[Home Voice Agent] Remote audio MediaStream not available')
      return
    }

    const audioContext = new AudioContext({
      latencyHint: 'interactive',
    })

    const source = audioContext.createMediaStreamSource(srcObject)
    const gain = audioContext.createGain()
    const compressor = audioContext.createDynamicsCompressor()
    const outputGain = audioContext.createGain()

    // Raise quiet speech before compression, then restore output loudness after
    // peak control. This produces more perceived volume without simply clipping.
    gain.gain.value = 4

    compressor.threshold.value = -18
    compressor.knee.value = 12
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.2

    outputGain.gain.value = 3

    source.connect(gain)
    gain.connect(compressor)
    compressor.connect(outputGain)
    outputGain.connect(audioContext.destination)

    audioElement.muted = true

    await audioContext.resume()

    this.audioContext = audioContext
    this.audioSource = source
    this.audioGain = gain
    this.audioCompressor = compressor
    this.audioOutputGain = outputGain
  }
}
