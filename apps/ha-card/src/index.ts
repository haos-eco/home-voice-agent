import { HomeVoiceAgentController, type VoiceAgentState } from './home-voice-agent.js'

type KioskWakeModel = {
  id: string
  wakeWord: string
  manifestUrl: string
}

type KioskWakeConfig = {
  engine: 'microWakeWord' | 'openWakeWord' | 'vsWakeWord'
  models: KioskWakeModel[]
}

type KioskWakeState = {
  available?: boolean
  active?: boolean
  listening?: boolean
  engine?: string | null
  status?: string | null
  released?: boolean
}

type KioskSatelliteApi = {
  platform?: string
  setWakeWordConfig(config: KioskWakeConfig): Promise<{
    available?: boolean
    stopWordAvailable?: boolean
  } | null>
  setWakeWordActive(active: boolean): Promise<boolean | null>
  releaseWakeWord(options: { reason: 'muted' | 'browser' }): Promise<boolean | null>
  getWakeWordState(): Promise<KioskWakeState | null>
  setInteractionActive?(active: boolean, reason?: string): Promise<boolean | null>
}

const WAKE_CONFIG: KioskWakeConfig = {
  engine: 'microWakeWord',
  models: [
    {
      id: 'hey_harvey',
      wakeWord: 'Hey Harvey',
      manifestUrl: 'http://homeassistant.local:8123/local/home-voice/hey_harvey.json',
    },
  ],
}

function kioskSatellite(): KioskSatelliteApi | null {
  const kiosk = window.kioskSatellite
  if (!kiosk || kiosk.platform !== 'kiosksatellite') return null

  return kiosk
}

async function configureKioskWakeWord(): Promise<boolean> {
  const kiosk = kioskSatellite()
  if (!kiosk) return false

  const result = await kiosk.setWakeWordConfig(WAKE_CONFIG)

  if (!result?.available) {
    const state = await kiosk.getWakeWordState()
    console.warn('[Home Voice Agent] Kiosk wake engine unavailable', state)
    return false
  }

  await kiosk.setWakeWordActive(true)
  const state = await kiosk.getWakeWordState()
  console.info('[Home Voice Agent] Kiosk wake ready', state)

  return true
}

async function ensureKioskWakeActive(): Promise<void> {
  const kiosk = kioskSatellite()
  if (!kiosk) return

  const state = await kiosk.getWakeWordState()

  if (
    !state ||
    state.released ||
    state.status === 'browser' ||
    state.status === 'released' ||
    state.engine !== WAKE_CONFIG.engine ||
    !state.available
  ) {
    await configureKioskWakeWord()
    return
  }

  await kiosk.setWakeWordActive(true)
}

if (!window.homeVoiceAgent) {
  window.homeVoiceAgent = new HomeVoiceAgentController()
}

const agent = window.homeVoiceAgent

/*
 * Before the browser voice agent starts using the microphone,
 * release it from Kiosk Satellite.
 *
 * With the optimized controller this preparation runs in parallel
 * with token/context/area preparation.
 */
agent.setPrepareInputHook(async () => {
  const kiosk = kioskSatellite()
  if (!kiosk) return

  const released = await kiosk.releaseWakeWord({
    reason: 'browser',
  })

  if (!released) {
    throw new Error('Kiosk Satellite did not release the microphone.')
  }
})

/*
 * Wake-word event.
 *
 * Do NOT pass inputReady: true here.
 * agent.start() must execute prepareInputHook so Kiosk Satellite
 * releases its microphone before Realtime takes control.
 */
if (!window.__homeVoiceAgentKioskWakeBound) {
  window.__homeVoiceAgentKioskWakeBound = true

  window.addEventListener('kiosksatellite:wakeword', (event: Event) => {
    const detail = (
      event as CustomEvent<{
        model?: string
        phrase?: string
      }>
    ).detail

    console.info(
      '[Home Voice Agent] Kiosk Satellite wake word:',
      detail?.phrase ?? 'unknown',
      detail?.model ?? '',
    )

    void agent.start()
  })
}

/*
 * Keep Kiosk Satellite informed about the voice-agent lifecycle.
 *
 * While Realtime is active, interaction mode stays enabled.
 * When the agent returns to idle, wake-word listening resumes.
 */
if (!window.__homeVoiceAgentStateBound) {
  window.__homeVoiceAgentStateBound = true

  window.addEventListener('home-voice-agent-state-changed', (event: Event) => {
    const detail = (
      event as CustomEvent<{
        state?: VoiceAgentState
      }>
    ).detail

    const state = detail?.state
    const kiosk = kioskSatellite()

    if (!kiosk || !state) return

    if (state === 'connecting' || state === 'listening' || state === 'speaking') {
      void kiosk.setInteractionActive?.(true, 'voice')
      return
    }

    if (state === 'error') {
      void kiosk.setInteractionActive?.(false, 'voice')
      return
    }

    if (state === 'idle') {
      void kiosk.setInteractionActive?.(false, 'voice')
      void ensureKioskWakeActive()
    }
  })
}

/*
 * Configure the wake engine once when the frontend initializes.
 */
if (!window.__homeVoiceAgentKioskWakeConfigured && !window.__homeVoiceAgentKioskWakeSetupPromise) {
  window.__homeVoiceAgentKioskWakeSetupPromise = configureKioskWakeWord()
    .then(ready => {
      window.__homeVoiceAgentKioskWakeConfigured = ready
    })
    .catch(error => {
      console.error('[Home Voice Agent] Kiosk wake setup failed', error)
    })
    .finally(() => {
      window.__homeVoiceAgentKioskWakeSetupPromise = undefined
    })
}

console.info(
  '%c HOME VOICE AGENT %c v0.5.0 %c',
  'color:#fff;background:#596d87;font-weight:700;padding:3px 6px',
  'color:#596d87;background:#fff;font-weight:700;padding:3px 6px',
)
