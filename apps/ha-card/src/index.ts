import { HomeVoiceAgentController } from './home-voice-agent.js'

if (!window.homeVoiceAgent) {
  window.homeVoiceAgent = new HomeVoiceAgentController()
}

if (!window.__homeVoiceAgentKioskWakeBound) {
  window.__homeVoiceAgentKioskWakeBound = true

  window.addEventListener('kiosksatellite:wakeword', (event: Event) => {
    const detail = (
      event as CustomEvent<{
        phrase?: string
      }>
    ).detail

    console.info('[Home Voice Agent] Kiosk Satellite wake word:', detail?.phrase ?? 'unknown')

    void window.homeVoiceAgent?.start()
  })
}

console.info(
  '%c HOME VOICE AGENT %c v0.2.0 ',
  'color:#fff;background:#596d87;font-weight:700;padding:3px 6px',
  'color:#596d87;background:#fff;font-weight:700;padding:3px 6px',
)
