declare global {
  interface Window {
    homeVoiceAgent?: HomeVoiceAgentController
    kioskSatellite?: KioskSatelliteApi

    __homeVoiceAgentKioskWakeBound?: boolean
    __homeVoiceAgentStateBound?: boolean
    __homeVoiceAgentKioskWakeSetupPromise?: Promise<void> | undefined
    __homeVoiceAgentKioskWakeConfigured?: boolean
  }
}
export {}
