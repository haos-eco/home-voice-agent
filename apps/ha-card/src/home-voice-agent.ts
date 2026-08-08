import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  type OpenAIRealtimeModels,
} from '@openai/agents/realtime'

import { WakeWordStream, type WakeDetection } from './wake-word-stream.js'

export type VoiceAgentState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

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
  private idleAfterErrorTimer: number | null = null
  private currentState: VoiceAgentState = 'idle'
  private lastError: string | null = null
  private hassInitiallyBound = false
  private stopping = false

  private audioContext: AudioContext | null = null
  private audioSource: MediaStreamAudioSourceNode | null = null
  private audioGain: GainNode | null = null
  private audioCompressor: DynamicsCompressorNode | null = null

  private readonly wakeWord: WakeWordStream
  private wakeWordResumeTimer: number | null = null
  private wakeWordBootstrapTimer: number | null = null
  private wakeWordEnabled = false

  public constructor() {
    this.wakeWord = new WakeWordStream(async (detection: WakeDetection) => {
      console.info('[Home Voice Agent] Activated by wake word:', detection.keyword, detection.score)
      await this.start()
    })
  }

  public async enableWakeWord(): Promise<void> {
    this.wakeWordEnabled = true

    if (!this.config.room || !this.config.deviceId) {
      throw new Error('Voice agent room/device configuration is missing.')
    }

    if (this.session || this.currentState !== 'idle') {
      return
    }

    try {
      await this.wakeWord.start({
        room: this.config.room,
        deviceId: this.config.deviceId,
      })
    } catch (error) {
      console.error('[Home Voice Agent] Could not start wake listener', error)
      throw error
    }
  }

  public async disableWakeWord(): Promise<void> {
    this.wakeWordEnabled = false

    this.clearWakeWordResumeTimer()

    await this.wakeWord.stop()
  }

  public configure(partialConfig: Partial<VoiceAgentConfig>): void {
    this.config = {
      ...this.config,
      ...partialConfig,
    }

    this.scheduleWakeWordBootstrap()
  }

  public bindHass(hass: HassLike): void {
    this.hass = hass

    if (!this.hassInitiallyBound) {
      this.hassInitiallyBound = true
      void this.publishState()
    }

    this.scheduleWakeWordBootstrap()
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

  public async start(): Promise<void> {
    this.lastError = null

    if (this.session || this.currentState === 'connecting') {
      return
    }

    this.clearWakeWordResumeTimer()
    await this.wakeWord.stop()

    this.clearErrorTimer()
    this.setState('connecting')

    try {
      const credential = await this.requestClientCredential()

      const audioElement = document.createElement('audio')
      audioElement.autoplay = true

      const transport = new OpenAIRealtimeWebRTC({
        audioElement,
      })

      const agent = new RealtimeAgent({
        name: 'Dona',
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
                type: 'server_vad',
                threshold: 0.72,
                prefixPaddingMs: 300,
                silenceDurationMs: 1_000,
                createResponse: true,
                interruptResponse: true,
              },
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
          return
        }

        if (connectionState === 'disconnected' && !this.stopping && this.session === session) {
          this.releaseSession()
          this.setState('idle')
          this.resumeWakeWord()
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
    this.resumeWakeWord()
  }

  public interrupt(): void {
    this.session?.interrupt()
  }

  /**
   * Returns an animated SVG data URL for navbar-card.
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
      wakeWordEnabled: this.wakeWordEnabled,
      wakeWordActive: this.wakeWord.isActive,
      wakeWordBootstrapScheduled: this.wakeWordBootstrapTimer !== null,
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
        this.resumeWakeWord()
      }
    }, 8_000)
  }

  private releaseSession(): void {
    const session = this.session
    const audioElement = this.audioElement
    const audioContext = this.audioContext

    this.session = null
    this.audioElement = null

    this.audioContext = null
    this.audioSource = null
    this.audioGain = null
    this.audioCompressor = null

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

  private svgDataUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  private createIconSvg(state: VoiceAgentState): string {
    const speaking = state === 'speaking'

    const listening = state === 'listening'

    const connecting = state === 'connecting'

    const error = state === 'error'

    const active = speaking || listening

    const speed = speaking ? '1.05s' : listening ? '1.9s' : '4.2s'

    return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-10 -10 120 120"
      overflow="visible"
    >
      <defs>
        <radialGradient
          id="hva-core"
          cx="32%"
          cy="25%"
          r="85%"
        >
          <stop
            offset="0%"
            stop-color="#ffffff"
          />

          <stop
            offset="15%"
            stop-color="#8ff3ff"
          />

          <stop
            offset="38%"
            stop-color="#657cff"
          />

          <stop
            offset="61%"
            stop-color="#ad63ed"
          />

          <stop
            offset="82%"
            stop-color="#f16cb8"
          />

          <stop
            offset="100%"
            stop-color="#ffad73"
          />
        </radialGradient>

        <linearGradient
          id="hva-ring"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop
            offset="0%"
            stop-color="#65edff"
          />

          <stop
            offset="28%"
            stop-color="#6875ff"
          />

          <stop
            offset="59%"
            stop-color="#bd68ec"
          />

          <stop
            offset="81%"
            stop-color="#fa73b5"
          />

          <stop
            offset="100%"
            stop-color="#ffbd75"
          />
        </linearGradient>

        <filter
          id="hva-glow"
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feGaussianBlur
            stdDeviation="${active ? '4' : '2.5'}"
            result="blur"
          />

          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode
              in="SourceGraphic"
            />
          </feMerge>
        </filter>
      </defs>

      <!-- ambient halo -->

      <circle
        cx="50"
        cy="50"
        r="39"
        fill="${error ? '#ff5368' : '#707cff'}"
        opacity="${error ? '.22' : active ? '.17' : '.07'}"
      >
        <animate
          attributeName="r"
          values="${active ? '36;44;38;42;36' : '37;40;37'}"
          dur="${speed}"
          repeatCount="indefinite"
        />
      </circle>

      <g filter="url(#hva-glow)">

        <!-- main liquid body -->

        <circle
          cx="50"
          cy="50"
          r="${speaking ? '30' : '28'}"
          fill="url(#hva-core)"
        >
          <animate
            attributeName="r"
            values="${
              speaking ? '26;33;28;31;25;30;26' : listening ? '27;30;28;31;27' : '27;28.5;27'
            }"
            dur="${speed}"
            repeatCount="indefinite"
          />
        </circle>

        ${
          active
            ? `
              <ellipse
                cx="40"
                cy="42"
                rx="19"
                ry="14"
                fill="#5feaff"
                opacity=".34"
              >
                <animate
                  attributeName="cx"
                  values="38;54;45;38"
                  dur="${speed}"
                  repeatCount="indefinite"
                />

                <animate
                  attributeName="ry"
                  values="12;19;14;12"
                  dur="${speed}"
                  repeatCount="indefinite"
                />
              </ellipse>

              <ellipse
                cx="60"
                cy="60"
                rx="18"
                ry="15"
                fill="#fa68c0"
                opacity=".30"
              >
                <animate
                  attributeName="cx"
                  values="62;47;57;62"
                  dur="${speed}"
                  repeatCount="indefinite"
                />

                <animate
                  attributeName="rx"
                  values="15;22;18;15"
                  dur="${speed}"
                  repeatCount="indefinite"
                />
              </ellipse>

              <ellipse
                cx="52"
                cy="39"
                rx="15"
                ry="11"
                fill="#816cff"
                opacity=".22"
              >
                <animate
                  attributeName="cy"
                  values="36;51;40;36"
                  dur="${speed}"
                  repeatCount="indefinite"
                />
              </ellipse>
            `
            : ''
        }

        <!-- luminous outer edge -->

        <circle
          cx="50"
          cy="50"
          r="33"
          fill="none"
          stroke="url(#hva-ring)"
          stroke-width="${speaking ? '3.5' : '2.3'}"
          opacity=".88"
        >
          <animate
            attributeName="r"
            values="${active ? '31;35;32;34;31' : '32;33;32'}"
            dur="${speed}"
            repeatCount="indefinite"
          />

          <animate
            attributeName="opacity"
            values=".92;.48;.82;.60;.92"
            dur="${speed}"
            repeatCount="indefinite"
          />
        </circle>

      </g>

      ${
        connecting
          ? `
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="url(#hva-ring)"
              stroke-width="3"
              stroke-linecap="round"
              stroke-dasharray="27 240"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 50 50"
                to="360 50 50"
                dur=".8s"
                repeatCount="indefinite"
              />
            </circle>
          `
          : ''
      }

      ${
        error
          ? `
            <circle
              cx="50"
              cy="50"
              r="35"
              fill="#ff4f67"
              opacity=".15"
            >
              <animate
                attributeName="opacity"
                values=".08;.34;.08"
                dur=".9s"
                repeatCount="indefinite"
              />
            </circle>
          `
          : ''
      }
    </svg>
  `
  }

  private scheduleWakeWordBootstrap(): void {
    if (!this.hass) return

    if (!this.config.room || !this.config.deviceId) return

    if (this.session || this.currentState !== 'idle' || this.wakeWord.isActive) {
      return
    }

    if (this.wakeWordBootstrapTimer !== null) return

    console.info('[Home Voice Agent] Scheduling wake listener startup', {
      room: this.config.room,
      deviceId: this.config.deviceId,
    })

    this.wakeWordBootstrapTimer = window.setTimeout(() => {
      this.wakeWordBootstrapTimer = null

      if (
        !this.hass ||
        !this.config.room ||
        !this.config.deviceId ||
        this.session ||
        this.currentState !== 'idle' ||
        this.wakeWord.isActive
      ) {
        return
      }

      console.info('[Home Voice Agent] Starting wake listener', {
        room: this.config.room,
        deviceId: this.config.deviceId,
      })

      void this.enableWakeWord().catch(error => {
        console.error('[Home Voice Agent] Automatic wake startup failed', error)

        window.setTimeout(() => {
          this.scheduleWakeWordBootstrap()
        }, 2_000)
      })
    }, 1_500)
  }

  private clearWakeWordResumeTimer(): void {
    if (this.wakeWordResumeTimer === null) return
    window.clearTimeout(this.wakeWordResumeTimer)
    this.wakeWordResumeTimer = null
  }

  private resumeWakeWord(): void {
    this.clearWakeWordResumeTimer()

    if (!this.wakeWordEnabled || this.session || this.currentState !== 'idle') {
      return
    }

    this.wakeWordResumeTimer = window.setTimeout(() => {
      this.wakeWordResumeTimer = null

      if (!this.wakeWordEnabled || this.session || this.currentState !== 'idle') {
        return
      }

      void this.wakeWord
        .start({
          room: this.config.room,
          deviceId: this.config.deviceId,
        })
        .catch(error => {
          console.error('[Home Voice Agent] ' + 'Could not resume wake listener', error)
        })
    }, 500)
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

    gain.gain.value = 6

    compressor.threshold.value = -10
    compressor.knee.value = 12
    compressor.ratio.value = 8
    compressor.attack.value = 0.003
    compressor.release.value = 0.2

    source.connect(gain)
    gain.connect(compressor)
    compressor.connect(audioContext.destination)

    audioElement.muted = true

    await audioContext.resume()

    this.audioContext = audioContext
    this.audioSource = source
    this.audioGain = gain
    this.audioCompressor = compressor
  }
}
