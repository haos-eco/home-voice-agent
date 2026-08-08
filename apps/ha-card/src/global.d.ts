declare global {
  interface Window {
    homeVoiceAgent?: HomeVoiceAgentController
    __homeVoiceAgentKioskWakeBound?: boolean
  }
}

export {}
