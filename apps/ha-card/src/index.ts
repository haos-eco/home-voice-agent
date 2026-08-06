import {
  HomeVoiceAgentController,
} from "./home-voice-agent.js";

declare global {
  interface Window {
    homeVoiceAgent?: HomeVoiceAgentController;
  }
}

if (!window.homeVoiceAgent) {
  window.homeVoiceAgent =
    new HomeVoiceAgentController();
}

console.info(
  "%c HOME VOICE AGENT %c v0.1.0 ",
  "color:#fff;background:#596d87;font-weight:700;padding:3px 6px",
  "color:#596d87;background:#fff;font-weight:700;padding:3px 6px",
);
