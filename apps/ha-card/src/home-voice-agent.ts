import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  tool,
  type OpenAIRealtimeModels,
} from '@openai/agents/realtime'

export type VoiceAgentState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

export type VoiceAgentStartOptions = {
  inputReady?: boolean
}

type PrepareInputHook = () => Promise<void> | void

type HomeControlDomain = 'light' | 'switch' | 'fan' | 'climate' | 'media_player'

type HomeControlAction =
  | 'turn_on'
  | 'turn_off'
  | 'toggle'
  | 'set_temperature'
  | 'play'
  | 'pause'
  | 'play_pause'
  | 'set_volume'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'unmute'

type HomeControlArgs = {
  domain: HomeControlDomain
  action: HomeControlAction
  area: string | null
  entity: string | null
  whole_home: boolean
  temperature: number | null
  brightness_pct: number | null
  volume_level: number | null
}

type HomeStatusArgs = {
  area: string | null
  entity: string | null
  domain:
    HomeControlDomain | 'sensor' | 'binary_sensor' | 'lock' | 'cover' | 'alarm_control_panel' | null
  whole_home: boolean
}

type HomeFindEntitiesArgs = {
  query: string
  area: string | null
  domain: string | null
  whole_home: boolean
  limit: number
}

type HomeLearningObserveArgs = {
  kind: 'entity_alias' | 'numeric_preference'
  phrase: string | null
  area: string | null
  domain: string | null
  entity: string | null
  metric: 'temperature' | 'volume_level' | 'brightness_pct' | null
  value: number | null
  correction: boolean
}

type HomeEntityRegistryEntry = {
  entity_id: string
  area_id?: string | null
  device_id?: string | null
  name?: string | null
  original_name?: string | null
  aliases?: string[] | null
  disabled_by?: string | null
  hidden_by?: string | null
  platform?: string | null
}

type HomeDeviceRegistryEntry = {
  id: string
  area_id?: string | null
  name?: string | null
  name_by_user?: string | null
  manufacturer?: string | null
  model?: string | null
  model_id?: string | null
}

type HomeCatalogEntity = {
  entity_id: string
  domain: string
  friendly_name: string
  area_id: string | null
  area_name: string | null
  aliases: string[]
  device_id: string | null
  device_name: string | null
  device_model: string | null
  state: string
  device_class: string | null
  supported_features: number | null
  sensitive: boolean
}

type LearnedAliasEvidenceKind =
  | 'discovery'
  | 'successful_status'
  | 'successful_action'
  | 'explicit_learning'
  | 'explicit_correction'

type LearnedAliasEvidence =
  | {
      id: string
      kind: LearnedAliasEvidenceKind
      at: number
    }
  | {
      id: string
      kind: 'contradiction'
      at: number
      severity: 'normal' | 'explicit_correction'
    }
  | {
      id: string
      kind: 'legacy_snapshot'
      at: number
      confidence: number
      observations: number
      successful_uses: number
      contradictions: number
      last_used_at: number | null
    }

type LearnedPreferenceEvidence =
  | {
      id: string
      kind: 'implicit' | 'explicit' | 'correction'
      at: number
      value: number
    }
  | {
      id: string
      kind: 'legacy_snapshot'
      at: number
      value: number
      confidence: number
      observations: number
      last_used_at: number | null
    }

type LearnedEntityAlias = {
  id: string
  phrase: string
  normalized_phrase: string
  area_name: string | null
  domain: string | null
  entity_id: string
  confidence: number
  observations: number
  successful_uses: number
  contradictions: number
  created_at: number
  updated_at: number
  last_used_at: number | null
  evidence: LearnedAliasEvidence[]
}

type LearnedNumericPreference = {
  id: string
  metric: 'temperature' | 'volume_level' | 'brightness_pct'
  area_name: string | null
  entity_id: string
  value: number
  confidence: number
  observations: number
  created_at: number
  updated_at: number
  last_used_at: number | null
  evidence: LearnedPreferenceEvidence[]
}

type HomeLearningStore = {
  version: 2
  aliases: LearnedEntityAlias[]
  preferences: LearnedNumericPreference[]
  tombstones: Record<string, number>
  updated_at: number
}

type UserSpeechTranscript = {
  sequence: number
  itemId: string
  transcript: string
  normalized: string
  receivedAt: number
}

type FrontendUserDataResponse = {
  value?: unknown
}

type RecentDiscoveryHint = {
  query: string
  area: string | null
  domain: string | null
  expiresAt: number
}

type HomeSensitiveAction =
  | 'open'
  | 'close'
  | 'lock'
  | 'unlock'
  | 'press'
  | 'turn_on'
  | 'turn_off'
  | 'trigger'
  | 'arm_home'
  | 'arm_away'
  | 'disarm'

type HomeSensitiveControlArgs = {
  query: string
  area: string | null
  action: HomeSensitiveAction
  confirmation_token: string | null
}

type PendingSensitiveAction = {
  token: string
  createdAt: number
  expiresAt: number
  requiredUserSpeechSequence: number
  entityIds: string[]
  domain: string
  service: string
  action: HomeSensitiveAction
  label: string
  area: string | null
  learnedQuery: string
}

type HomeAreaEntry = {
  area_id: string
  name: string
  aliases?: string[] | null
}

type HomeTargetExtraction = {
  referenced_entities?: string[]
  referenced_devices?: string[]
  referenced_areas?: string[]
  missing_areas?: string[]
}

type HassState = {
  entity_id: string
  state: string
  attributes?: Record<string, unknown>
}

type HassEvent<T = Record<string, unknown>> = {
  event_type?: string
  data?: T
}

type HassConnectionLike = {
  subscribeEvents<T = Record<string, unknown>>(
    callback: (event: HassEvent<T>) => void,
    eventType?: string,
  ): Promise<() => Promise<void>>
}

type HassLike = {
  callWS<T>(message: Record<string, unknown>): Promise<T>
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<unknown>
  connection?: HassConnectionLike
  states?: Record<string, HassState>
}

type VoiceAgentConfig = {
  room: string
  deviceId: string
  stateEntity: string
  inactivityMs: number
  sensitiveEntityIds: string[]
  sensitiveDeviceIds: string[]
  nonSensitiveEntityIds: string[]
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
  sensitiveEntityIds: [],
  sensitiveDeviceIds: [],
  nonSensitiveEntityIds: [],
}

const HOME_KNOWLEDGE_REFRESH_MS = 60_000
const HOME_KNOWLEDGE_DEBOUNCE_MS = 750

const HOME_LEARNING_STORAGE_KEY = 'home_voice_agent_learning_v2'
const HOME_LEARNING_LEGACY_STORAGE_KEY = 'home_voice_agent_learning_v1'
const HOME_LEARNING_LOCAL_STORAGE_KEY = 'home_voice_agent_learning_v2_fallback'
const HOME_LEARNING_LEGACY_LOCAL_STORAGE_KEY = 'home_voice_agent_learning_v1_fallback'
const HOME_LEARNING_REFRESH_MS = 15_000
const HOME_LEARNING_SAVE_DEBOUNCE_MS = 600
const HOME_LEARNING_DISCOVERY_HINT_MS = 60_000
const HOME_LEARNING_MAX_ALIASES = 250
const HOME_LEARNING_MAX_PREFERENCES = 120
const HOME_LEARNING_MAX_TOMBSTONES = 4_000
const HOME_LEARNING_DIRECT_CONFIDENCE = 0.82
const HOME_LEARNING_PREFERENCE_CONTEXT_CONFIDENCE = 0.76
const HOME_LEARNING_BOOST_CONFIDENCE = 0.48
const HOME_LEARNING_STALE_REFRESH_LIMIT = 3
const HOME_LEARNING_AGENT_UPDATE_DEBOUNCE_MS = 250
const HOME_SENSITIVE_TRANSCRIPT_WAIT_MS = 2_500

const HOME_CONTROL_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    domain: {
      type: 'string',
      enum: ['light', 'switch', 'fan', 'climate', 'media_player'],
      description: 'Home Assistant entity domain to control.',
    },
    action: {
      type: 'string',
      enum: [
        'turn_on',
        'turn_off',
        'toggle',
        'set_temperature',
        'play',
        'pause',
        'play_pause',
        'set_volume',
        'volume_up',
        'volume_down',
        'mute',
        'unmute',
      ],
      description:
        'Action to perform. For media players, prefer volume_up/volume_down for relative requests such as alza/abbassa il volume; set_volume is for an explicit target level.',
    },
    area: {
      type: ['string', 'null'],
      description:
        'Explicit Home Assistant area named by the user. Use null when the user did not name an area. An explicitly named area always overrides the tablet room.',
    },
    entity: {
      type: ['string', 'null'],
      description:
        'Specific entity/device friendly name named by the user. Use null to target all matching entities in the selected area/scope.',
    },
    whole_home: {
      type: 'boolean',
      description:
        'True only when the user explicitly asks to target the whole house/home. Otherwise false.',
    },
    temperature: {
      type: ['number', 'null'],
      description: 'Target temperature for climate.set_temperature, otherwise null.',
    },
    brightness_pct: {
      type: ['number', 'null'],
      minimum: 0,
      maximum: 100,
      description: 'Light brightness percentage for light.turn_on, otherwise null.',
    },
    volume_level: {
      type: ['number', 'null'],
      minimum: 0,
      maximum: 1,
      description: 'Media-player volume from 0.0 to 1.0 for set_volume, otherwise null.',
    },
  },
  required: [
    'domain',
    'action',
    'area',
    'entity',
    'whole_home',
    'temperature',
    'brightness_pct',
    'volume_level',
  ],
} as const

const HOME_STATUS_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    area: {
      type: ['string', 'null'],
      description:
        'Explicit area to inspect. Use null when no area was named; the current tablet room is then used unless whole_home is true or a specific entity is named.',
    },
    entity: {
      type: ['string', 'null'],
      description: 'Specific friendly entity/device name to inspect, or null.',
    },
    domain: {
      type: ['string', 'null'],
      enum: [
        'light',
        'switch',
        'fan',
        'climate',
        'media_player',
        'sensor',
        'binary_sensor',
        'lock',
        'cover',
        'alarm_control_panel',
        null,
      ],
      description: 'Optional domain filter. Use null when the user did not imply a domain.',
    },
    whole_home: {
      type: 'boolean',
      description: 'True only for an explicit whole-home status request.',
    },
  },
  required: ['area', 'entity', 'domain', 'whole_home'],
} as const

const HOME_FIND_ENTITIES_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: {
      type: 'string',
      description:
        'Natural device/entity description from the user, such as tv, televisore, lampada comodino, condizionatore, speaker, temperatura, or the exact entity id.',
    },
    area: {
      type: ['string', 'null'],
      description:
        'Explicit room/area named by the user. Use null when none was named; the current tablet room is then searched first.',
    },
    domain: {
      type: ['string', 'null'],
      description:
        'Optional Home Assistant domain inferred from the request, such as media_player, light, climate, sensor. Use null when uncertain.',
    },
    whole_home: {
      type: 'boolean',
      description:
        'True only when discovery must cover the whole home. Otherwise false so the current or explicit room is preferred.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 12,
      description: 'Maximum number of candidate entities to return. Usually 5 is enough.',
    },
  },
  required: ['query', 'area', 'domain', 'whole_home', 'limit'],
} as const

const HOME_LEARNING_OBSERVE_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: {
      type: 'string',
      enum: ['entity_alias', 'numeric_preference'],
      description:
        'Use entity_alias when the user reveals what they call a device; use numeric_preference when they express a stable preferred temperature, volume, or brightness.',
    },
    phrase: {
      type: ['string', 'null'],
      description:
        'Natural household alias, such as TV, abat-jour, clima, or cancello. Required for entity_alias, otherwise null.',
    },
    area: {
      type: ['string', 'null'],
      description: 'Explicit area if stated; otherwise null so the current tablet room is used.',
    },
    domain: {
      type: ['string', 'null'],
      description:
        'Optional Home Assistant domain if known, for example media_player, light, climate.',
    },
    entity: {
      type: ['string', 'null'],
      description:
        'Natural device/entity description used to resolve the real Home Assistant entity. It does not need to be an entity_id.',
    },
    metric: {
      type: ['string', 'null'],
      enum: ['temperature', 'volume_level', 'brightness_pct', null],
      description: 'Numeric preference metric. Null for entity_alias.',
    },
    value: {
      type: ['number', 'null'],
      description:
        'Numeric preference value. volume_level uses 0..1, brightness_pct uses 0..100. Null for entity_alias.',
    },
    correction: {
      type: 'boolean',
      description:
        'True when the user is explicitly correcting a previous device meaning or preference; otherwise false.',
    },
  },
  required: ['kind', 'phrase', 'area', 'domain', 'entity', 'metric', 'value', 'correction'],
} as const

const HOME_SENSITIVE_CONTROL_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: {
      type: 'string',
      description:
        'Natural target description, for example cancello, porta di casa, serratura ingresso, garage, or the exact entity name.',
    },
    area: {
      type: ['string', 'null'],
      description:
        'Explicit area named by the user, otherwise null. Sensitive targets may still be discovered globally when no area was named.',
    },
    action: {
      type: 'string',
      enum: [
        'open',
        'close',
        'lock',
        'unlock',
        'press',
        'turn_on',
        'turn_off',
        'trigger',
        'arm_home',
        'arm_away',
        'disarm',
      ],
      description:
        'Requested sensitive action. Opening/unlocking/disarming and other access/security actions always require explicit user confirmation.',
    },
    confirmation_token: {
      type: ['string', 'null'],
      description:
        'Null on the first call. If the tool returns requires_confirmation, ask the user for explicit confirmation and call again with the returned token only after the user replies affirmatively.',
    },
  },
  required: ['query', 'area', 'action', 'confirmation_token'],
} as const

const HOME_LIST_AREAS_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {},
  required: [],
} as const

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

# Home Assistant

You can inspect and control supported Home Assistant devices using your tools.

Targeting rules are important:
- The tablet's physical room is only the DEFAULT target when the user does not name another room or device.
- If the user explicitly names a room, ALWAYS target that room, even when this tablet is physically somewhere else.
- Example: if this tablet is in the bedroom and the user says "Spegni tutte le luci in cucina", target the kitchen, not the bedroom.
- If the user explicitly asks for the whole house, use whole-home targeting.
- If the user names a specific entity/device, target that entity rather than every entity in the room.
- The user should NOT need to know exact Home Assistant entity names or entity IDs.
- Understand ordinary household references such as "TV", "televisore", "lampada", "condizionatore", "speaker", or "termostato" from context.
- A persistent learning layer silently learns the user's household vocabulary and repeated numeric preferences from successful interactions.
- When calling discovery/control tools, preserve the user's natural device wording in query/entity when practical. Do not replace "TV" with an exact entity id unless necessary; the learning layer uses that natural wording as evidence.
- Do not announce that you learned or updated confidence unless the user asks about memory/learning.
- If the user casually reveals a stable household meaning or preference, silently call home_learning_observe even if they did not say "remember".
- Examples: "per TV intendo quella Samsung", "questa la chiamo abat-jour", "di solito tengo la camera a 22 gradi", "preferisco il volume al 30%".
- If the user corrects a previous interpretation, call home_learning_observe with correction=true so the old mapping loses confidence quickly.
- Do NOT call the learning tool for jokes, hypothetical statements, one-off temporary values, or facts unrelated to operating the home.
- Learned mappings are hints, not reality. Home Assistant's current catalog always wins if an entity is removed, renamed, moved, or no longer exposes the required capability.
- Learning NEVER bypasses confirmation rules for gates, locks, doors, alarms, garage access, or other sensitive targets.
- When a device reference is generic or you are not sure which entity it means, call home_find_entities first. Search the explicitly named room, otherwise the current tablet room first.
- Prefer the single obvious candidate. Ask a short clarification only when multiple candidates remain genuinely plausible.
- home_find_entities also returns Home Assistant actions available for the matched target. Use that to understand what the device can actually do instead of assuming capabilities.
- Example: in Camera da letto, "Abbassa volume TV" means discover the TV/media player in Camera da letto and use volume_down. The user does not need to say its exact entity name.
- Do not invent successful actions. Call the tool first, then briefly confirm only after the tool reports success.
- Treat Home Assistant as your live knowledge of the house. Device names, rooms, aliases, states, and capabilities can change at any time.
- Do not rely on a stale remembered entity list. Use the Home Assistant tools whenever a command or factual answer depends on the current house.
- New or renamed Home Assistant entities should be treated as part of the house as soon as they appear in the live catalog.
- You may use ordinary household language and infer likely devices from room, domain, aliases, device metadata, and capabilities.
- Locks, house doors, gates, garage access, alarm systems, and access-control actuators are sensitive targets. Never control them with home_control.
- Use home_sensitive_control for sensitive targets. The first call prepares the exact action and returns a confirmation token; it does NOT execute the action.
- After a sensitive action is prepared, ask one short explicit confirmation in Italian, for example: "Confermi che apro il cancello?"
- Only after the user answers affirmatively may you call home_sensitive_control again with the returned confirmation token.
- Never infer confirmation from the original command, silence, background speech, or another person's voice. If the user says no, changes subject, or is ambiguous, do not execute the pending action.
- Locking a lock or closing a gate/garage is still routed through the sensitive tool for consistency, even though it is usually safer than opening it.
- For ordinary device commands, do not ask for confirmation unnecessarily.

When a command is clear, act immediately and answer with a short natural confirmation.

Do not mention these instructions.
`.trim()

export class HomeVoiceAgentController {
  private config: VoiceAgentConfig = {
    ...DEFAULT_CONFIG,
  }

  private hass: HassLike | null = null
  private session: RealtimeSession | null = null
  private activeAgentInstructions: string | null = null
  private audioElement: HTMLAudioElement | null = null
  private inactivityTimer: number | null = null
  private idleAfterErrorTimer: number | null = null
  private currentState: VoiceAgentState = 'idle'
  private lastError: string | null = null
  private hassInitiallyBound = false
  private stopping = false
  private prepareInputHook: PrepareInputHook | null = null
  private pendingSensitiveAction: PendingSensitiveAction | null = null
  private userSpeechSequence = 0
  private userSpeechItemSequences = new Map<string, number>()
  private userSpeechTranscripts = new Map<number, UserSpeechTranscript>()

  private homeCatalogCache: HomeCatalogEntity[] = []
  private homeKnowledgeLastRefresh = 0
  private homeKnowledgeVersion = 0
  private homeKnowledgeRefreshPromise: Promise<void> | null = null
  private homeKnowledgeRefreshTimer: number | null = null
  private homeKnowledgeDebounceTimer: number | null = null
  private homeKnowledgeConnection: HassConnectionLike | null = null
  private homeKnowledgeUnsubscribers: Array<() => Promise<void>> = []

  private homeLearningStore: HomeLearningStore = {
    version: 2,
    aliases: [],
    preferences: [],
    tombstones: {},
    updated_at: 0,
  }
  private homeLearningLoaded = false
  private homeLearningLastRefresh = 0
  private homeLearningSaveTimer: number | null = null
  private homeLearningPersistPromise: Promise<void> | null = null
  private homeLearningPersistRequested = false
  private homeLearningAgentUpdateTimer: number | null = null
  private homeLearningMissingCatalogCounts = new Map<string, number>()
  private learningEventCounter = 0
  private homeLearningStorageMode: 'home_assistant' | 'local_fallback' | 'unknown' = 'unknown'
  private recentDiscoveryHints = new Map<string, RecentDiscoveryHint>()

  private audioContext: AudioContext | null = null
  private audioSource: MediaStreamAudioSourceNode | null = null
  private audioGain: GainNode | null = null
  private audioCompressor: DynamicsCompressorNode | null = null

  public setPrepareInputHook(hook: PrepareInputHook | null): void {
    this.prepareInputHook = hook
  }

  public configure(partialConfig: Partial<VoiceAgentConfig>): void {
    this.config = {
      ...this.config,
      ...partialConfig,
      sensitiveEntityIds: partialConfig.sensitiveEntityIds
        ? [...new Set(partialConfig.sensitiveEntityIds.filter(Boolean))]
        : this.config.sensitiveEntityIds,
      sensitiveDeviceIds: partialConfig.sensitiveDeviceIds
        ? [...new Set(partialConfig.sensitiveDeviceIds.filter(Boolean))]
        : this.config.sensitiveDeviceIds,
      nonSensitiveEntityIds: partialConfig.nonSensitiveEntityIds
        ? [...new Set(partialConfig.nonSensitiveEntityIds.filter(Boolean))]
        : this.config.nonSensitiveEntityIds,
    }

    for (const entity of this.homeCatalogCache) {
      entity.sensitive = this.isSensitiveHomeEntity(entity)
    }
  }

  public bindHass(hass: HassLike): void {
    this.hass = hass

    if (!this.hassInitiallyBound) {
      this.hassInitiallyBound = true
      void this.publishState()
      void this.refreshHomeKnowledge('initial bind')
      void this.refreshHomeLearningMemory(true)
      this.startHomeKnowledgeRefreshTimer()
    } else {
      this.syncHomeKnowledgeStatesFromHass()
    }

    if (hass.connection && hass.connection !== this.homeKnowledgeConnection) {
      void this.bindHomeKnowledgeSubscriptions(hass.connection)
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
    this.pendingSensitiveAction = null
    this.userSpeechSequence = 0
    this.userSpeechItemSequences.clear()
    this.userSpeechTranscripts.clear()

    if (this.session || this.currentState === 'connecting') {
      return
    }

    this.clearErrorTimer()
    this.setState('connecting')

    try {
      if (!options.inputReady && this.prepareInputHook) {
        await this.prepareInputHook()
      }

      await this.refreshHomeLearningMemory(false)

      const credential = await this.requestClientCredential()

      const audioElement = document.createElement('audio')
      audioElement.autoplay = true

      const transport = new OpenAIRealtimeWebRTC({
        audioElement,
      })

      const homeAreas = await this.getHomeAreas().catch(error => {
        console.warn('[Home Voice Agent] Could not load Home Assistant areas', error)
        return [] as HomeAreaEntry[]
      })

      const agentInstructions = this.buildAgentInstructions(homeAreas)
      const agent = new RealtimeAgent({
        name: 'Dona',
        voice: 'marin',
        instructions: agentInstructions,
        tools: this.createHomeAssistantTools(),
      })
      this.activeAgentInstructions = agentInstructions

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
        this.handleRealtimeTransportEvent(event)
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
    this.pendingSensitiveAction = null

    this.clearInactivityTimer()
    this.clearErrorTimer()
    this.releaseSession()

    this.setState('idle')
    this.stopping = false
  }

  public interrupt(): void {
    this.session?.interrupt()
  }

  private handleRealtimeTransportEvent(event: unknown): void {
    if (!event || typeof event !== 'object' || !('type' in event)) return

    const payload = event as Record<string, unknown>
    const type = typeof payload.type === 'string' ? payload.type : ''

    if (type === 'input_audio_buffer.speech_started') {
      this.userSpeechSequence += 1

      if (typeof payload.item_id === 'string') {
        this.userSpeechItemSequences.set(payload.item_id, this.userSpeechSequence)
      }

      this.pruneUserSpeechTracking()
      this.setState('listening')
      this.resetInactivityTimer()
      return
    }

    if (type === 'input_audio_buffer.committed' && typeof payload.item_id === 'string') {
      if (!this.userSpeechItemSequences.has(payload.item_id)) {
        this.userSpeechItemSequences.set(payload.item_id, Math.max(1, this.userSpeechSequence))
      }
      return
    }

    if (
      type === 'conversation.item.input_audio_transcription.completed' &&
      typeof payload.item_id === 'string' &&
      typeof payload.transcript === 'string'
    ) {
      const sequence = this.userSpeechItemSequences.get(payload.item_id)

      if (!sequence) return

      const transcript = payload.transcript.trim()
      if (!transcript) return

      this.userSpeechTranscripts.set(sequence, {
        sequence,
        itemId: payload.item_id,
        transcript,
        normalized: this.normalizeConfirmationSpeech(transcript),
        receivedAt: Date.now(),
      })
      this.pruneUserSpeechTracking()
    }
  }

  private pruneUserSpeechTracking(): void {
    const minimumSequence = Math.max(0, this.userSpeechSequence - 12)

    for (const [itemId, sequence] of this.userSpeechItemSequences) {
      if (sequence < minimumSequence) this.userSpeechItemSequences.delete(itemId)
    }

    for (const sequence of this.userSpeechTranscripts.keys()) {
      if (sequence < minimumSequence) this.userSpeechTranscripts.delete(sequence)
    }
  }

  private async waitForUserSpeechTranscript(
    sequence: number,
    timeoutMs = HOME_SENSITIVE_TRANSCRIPT_WAIT_MS,
  ): Promise<UserSpeechTranscript | null> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() <= deadline) {
      const transcript = this.userSpeechTranscripts.get(sequence)
      if (transcript) return transcript
      await new Promise(resolve => window.setTimeout(resolve, 50))
    }

    return null
  }

  private normalizeConfirmationSpeech(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private isExplicitSensitiveConfirmation(transcript: string): boolean {
    const normalized = this.normalizeConfirmationSpeech(transcript)
    if (!normalized) return false

    const words = new Set(normalized.split(' '))
    const negativeWords = new Set([
      'no',
      'non',
      'annulla',
      'annullare',
      'fermo',
      'ferma',
      'stop',
      'aspetta',
      'aspettare',
      'lascia',
    ])

    if ([...negativeWords].some(word => words.has(word))) {
      return false
    }

    const exactAffirmatives = new Set([
      'si',
      'si confermo',
      'si procedi',
      'si procedi pure',
      'si vai',
      'si vai pure',
      'si fallo',
      'si fallo pure',
      'confermo',
      'conferma',
      'ok',
      'okay',
      'ok confermo',
      'okay confermo',
      'va bene',
      'procedi',
      'procedi pure',
      'vai',
      'vai pure',
      'fallo',
      'fallo pure',
    ])

    return exactAffirmatives.has(normalized)
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
      homeDiscovery: 'live Home Assistant knowledge graph',
      homeKnowledgeEntities: this.homeCatalogCache.length,
      homeKnowledgeVersion: this.homeKnowledgeVersion,
      homeKnowledgeLastRefresh: this.homeKnowledgeLastRefresh || null,
      homeKnowledgeSubscriptions: this.homeKnowledgeUnsubscribers.length,
      learnedAliases: this.homeLearningStore.aliases.length,
      learnedHighConfidenceAliases: this.homeLearningStore.aliases.filter(
        alias => alias.confidence >= HOME_LEARNING_DIRECT_CONFIDENCE,
      ).length,
      learnedPreferences: this.homeLearningStore.preferences.length,
      learningStoreVersion: this.homeLearningStore.version,
      learningStorage: this.homeLearningStorageMode,
      sensitiveEntityOverrides: this.config.sensitiveEntityIds.length,
      sensitiveDeviceOverrides: this.config.sensitiveDeviceIds.length,
      learningLastRefresh: this.homeLearningLastRefresh || null,
      sensitiveActionPending: Boolean(this.pendingSensitiveAction),
    }
  }

  private buildAgentInstructions(areas: HomeAreaEntry[]): string {
    const areaNames = areas.map(area => area.name).filter(Boolean)
    const room = this.config.room || 'unknown'
    const learnedContext = this.buildLearnedContextSummary()

    return `${AGENT_INSTRUCTIONS}

# Current endpoint context

- This voice endpoint/tablet is configured for room: ${room}.
- Home Assistant areas currently available: ${areaNames.length > 0 ? areaNames.join(', ') : 'not available'}.
- The live Home Assistant knowledge layer currently knows ${this.homeCatalogCache.length} entities and is refreshed automatically when Home Assistant changes.
- Remember: the current endpoint room is only a fallback. Any room explicitly named by the user takes priority.
${learnedContext}`
  }

  private buildLearnedContextSummary(): string {
    const aliases = this.homeLearningStore.aliases
      .filter(alias => alias.confidence >= HOME_LEARNING_DIRECT_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at)
      .slice(0, 24)
      .map(alias => {
        const area = alias.area_name ? ` in ${alias.area_name}` : ''
        return `- "${alias.phrase}"${area} -> ${alias.entity_id} (confidence ${alias.confidence.toFixed(2)})`
      })

    const preferences = this.homeLearningStore.preferences
      .filter(preference => preference.confidence >= HOME_LEARNING_PREFERENCE_CONTEXT_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at)
      .slice(0, 16)
      .map(preference => {
        const area = preference.area_name ? ` in ${preference.area_name}` : ''
        return `- ${preference.metric}${area} for ${preference.entity_id}: ${Number(preference.value.toFixed(3))} (confidence ${preference.confidence.toFixed(2)})`
      })

    if (aliases.length === 0 && preferences.length === 0) {
      return '- No high-confidence learned household mappings are available yet.'
    }

    return `# Learned household context

These are persistent learned hints from repeated successful use. They never override current Home Assistant reality or sensitive-action confirmation.

${aliases.length > 0 ? `Learned aliases:\n${aliases.join('\n')}` : 'Learned aliases: none yet.'}

${preferences.length > 0 ? `Learned numeric preferences:\n${preferences.join('\n')}` : 'Learned numeric preferences: none yet.'}`
  }

  private scheduleActiveAgentLearningRefresh(): void {
    if (!this.session) return

    if (this.homeLearningAgentUpdateTimer !== null) {
      window.clearTimeout(this.homeLearningAgentUpdateTimer)
    }

    this.homeLearningAgentUpdateTimer = window.setTimeout(() => {
      this.homeLearningAgentUpdateTimer = null
      void this.refreshActiveAgentLearningContext()
    }, HOME_LEARNING_AGENT_UPDATE_DEBOUNCE_MS)
  }

  private async refreshActiveAgentLearningContext(): Promise<void> {
    const session = this.session
    if (!session) return

    const areas = await this.getHomeAreas().catch(error => {
      console.warn('[Home Voice Agent] Could not refresh areas for learned context', error)
      return [] as HomeAreaEntry[]
    })
    const instructions = this.buildAgentInstructions(areas)

    if (instructions === this.activeAgentInstructions) return

    const updatedAgent = new RealtimeAgent({
      name: 'Dona',
      voice: 'marin',
      instructions,
      tools: this.createHomeAssistantTools(),
    })

    try {
      const updatableSession = session as RealtimeSession & {
        updateAgent?: (agent: RealtimeAgent) => Promise<unknown>
      }

      if (typeof updatableSession.updateAgent === 'function') {
        await updatableSession.updateAgent(updatedAgent)
      } else {
        const rawTransport = session.transport as typeof session.transport & {
          sendEvent?: (event: Record<string, unknown>) => void
        }

        if (typeof rawTransport.sendEvent !== 'function') {
          throw new Error('The installed Realtime SDK cannot update session instructions live.')
        }

        rawTransport.sendEvent({
          type: 'session.update',
          session: { instructions },
        })
      }

      if (this.session === session) {
        this.activeAgentInstructions = instructions
      }
    } catch (error) {
      if (this.session === session) {
        console.warn('[Home Voice Agent] Could not update learned realtime context', error)
      }
    }
  }

  private createHomeAssistantTools() {
    const control = tool({
      name: 'home_control',
      description:
        'Control supported Home Assistant entities. Use the explicitly named area even when it differs from the tablet room. If no area and no specific entity are named, the tablet room is the default. Use whole_home only when the user explicitly asks for the whole house. This tool supports lights, switches, fans, climate, and media players; it does not control locks, gates, alarms, garage doors, or security devices.',
      parameters: HOME_CONTROL_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeHomeControl(input as HomeControlArgs),
    })

    const status = tool({
      name: 'home_status',
      description:
        'Read the current state of Home Assistant entities in an area, for a named entity, or across the whole home. Explicitly named areas override the tablet room. Use this before answering factual questions about device or sensor state.',
      parameters: HOME_STATUS_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeHomeStatus(input as HomeStatusArgs),
    })

    const findEntities = tool({
      name: 'home_find_entities',
      description:
        'Discover Home Assistant entities from natural household language and learn their real capabilities. Use this when the user says things like TV, televisore, lampada, condizionatore, speaker, termostato, or another generic device name instead of an exact Home Assistant entity. Explicit areas override the tablet room; otherwise search the current tablet room first. Returns ranked candidates plus actions Home Assistant says are applicable to those targets.',
      parameters: HOME_FIND_ENTITIES_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeHomeFindEntities(input as HomeFindEntitiesArgs),
    })

    const learningObserve = tool({
      name: 'home_learning_observe',
      description:
        'Silently record a stable household alias/correction or numeric home preference revealed by the user. Use without announcing it. Resolve the real Home Assistant entity first; learning never changes sensitive-action confirmation rules.',
      parameters: HOME_LEARNING_OBSERVE_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeHomeLearningObserve(input as HomeLearningObserveArgs),
    })

    const sensitiveControl = tool({
      name: 'home_sensitive_control',
      description:
        'Prepare and, only after a separate explicit user confirmation, execute sensitive Home Assistant actions such as opening/closing a gate or garage, locking/unlocking/opening a house door, pressing an access-control button, or arming/disarming an alarm. The first call returns requires_confirmation and a token without executing anything. Ask the user to confirm, then call again with that token only after the user has spoken an affirmative response.',
      parameters: HOME_SENSITIVE_CONTROL_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeHomeSensitiveControl(input as HomeSensitiveControlArgs),
    })

    const listAreas = tool({
      name: 'home_list_areas',
      description:
        'List the Home Assistant areas/rooms that can be targeted. Use when the user asks what rooms exist or when a target room is ambiguous.',
      parameters: HOME_LIST_AREAS_PARAMETERS as any,
      strict: true,
      execute: async () => {
        const areas = await this.getHomeAreas()

        return JSON.stringify({
          ok: true,
          current_room: this.config.room || null,
          areas: areas.map(area => ({ id: area.area_id, name: area.name })),
        })
      },
    })

    return [findEntities, control, learningObserve, sensitiveControl, status, listAreas]
  }

  private async executeHomeLearningObserve(args: HomeLearningObserveArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({
        ok: false,
        error: 'Home Assistant is not connected.',
      })
    }

    try {
      await this.refreshHomeLearningMemory(false)

      const areaName = args.area || this.config.room || null

      if (args.kind === 'entity_alias') {
        if (!args.phrase || !args.entity) {
          return JSON.stringify({
            ok: false,
            error: 'entity_alias requires phrase and entity.',
          })
        }

        const entityIds = await this.resolveHomeTargets({
          domain: args.domain || undefined,
          area: args.area,
          entity: args.entity,
          wholeHome: false,
        })

        const entity = entityIds[0]

        if (entityIds.length !== 1 || !entity) {
          return JSON.stringify({
            ok: false,
            error: 'The alias target must resolve to exactly one Home Assistant entity.',
            targets: entityIds,
          })
        }

        const catalog = await this.getHomeCatalog()
        const target = catalog.find(({ entity_id }) => entity_id === entity)

        await this.observeLearnedAlias({
          phrase: args.phrase,
          areaName: args.area || target?.area_name || areaName,
          domain: args.domain || target?.domain || null,
          entityId: entity,
          evidence: args.correction ? 'explicit_correction' : 'explicit_learning',
        })

        return JSON.stringify({
          ok: true,
          learned: 'entity_alias',
          phrase: args.phrase,
          target: entity,
          area: args.area || target?.area_name || areaName,
          correction: args.correction,
        })
      }

      const sanitizedPreferenceValue = args.metric
        ? this.sanitizePreferenceValue(args.metric, args.value)
        : null

      if (!args.metric || sanitizedPreferenceValue === null || !args.entity) {
        return JSON.stringify({
          ok: false,
          error:
            'numeric_preference requires a valid metric, an in-range value, and a resolvable entity.',
        })
      }

      const entityIds = await this.resolveHomeTargets({
        domain: args.domain || undefined,
        area: args.area,
        entity: args.entity,
        wholeHome: false,
      })

      const entity = entityIds[0]

      if (entityIds.length !== 1 || !entity) {
        return JSON.stringify({
          ok: false,
          error: 'The numeric preference target must resolve to exactly one Home Assistant entity.',
          targets: entityIds,
        })
      }

      const catalog = await this.getHomeCatalog()
      const target = catalog.find(({ entity_id }) => entity_id === entity)

      await this.observeNumericPreference({
        metric: args.metric,
        value: sanitizedPreferenceValue,
        areaName: args.area || target?.area_name || areaName,
        entityId: entity,
        evidence: args.correction ? 'correction' : 'explicit',
      })

      return JSON.stringify({
        ok: true,
        learned: 'numeric_preference',
        metric: args.metric,
        value: sanitizedPreferenceValue,
        target: entity,
        area: args.area || target?.area_name || areaName,
        correction: args.correction,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      console.warn('[Home Voice Agent] Silent learning observation failed', error)

      return JSON.stringify({
        ok: false,
        error: message,
      })
    }
  }

  private async executeHomeFindEntities(args: HomeFindEntitiesArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    try {
      const limit = Math.max(1, Math.min(12, Math.trunc(args.limit || 5)))
      await this.refreshHomeLearningMemory(false)

      const result = await this.findHomeEntities({
        query: args.query,
        area: args.area,
        domain: args.domain,
        wholeHome: args.whole_home,
        limit,
      })

      const hintArea = args.area || (!args.whole_home ? this.config.room || null : null)

      for (const entity of result.entities) {
        this.recentDiscoveryHints.set(entity.entity_id, {
          query: args.query,
          area: hintArea,
          domain: args.domain,
          expiresAt: Date.now() + HOME_LEARNING_DISCOVERY_HINT_MS,
        })
      }

      if (result.entities.length > 0) {
        const first = result.entities[0]
        if (!first) {
          return JSON.stringify({
            ok: false,
            error: 'No matching Home Assistant entity found.',
          })
        }

        void this.observeLearnedAlias({
          phrase: args.query,
          areaName: hintArea,
          domain: args.domain || first.domain,
          entityId: first.entity_id,
          evidence: 'discovery',
        })
      }

      return JSON.stringify({
        ok: true,
        current_room: this.config.room || null,
        requested_area: args.area,
        query: args.query,
        domain: args.domain,
        whole_home: args.whole_home,
        candidates: result.entities,
        available_actions: result.actions,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[Home Voice Agent] Home Assistant discovery failed', error)
      return JSON.stringify({ ok: false, error: message })
    }
  }

  private async findHomeEntities(options: {
    query: string
    area: string | null
    domain: string | null
    wholeHome: boolean
    limit: number
  }): Promise<{ entities: HomeCatalogEntity[]; actions: string[] }> {
    await this.refreshHomeLearningMemory(false)

    const catalog = await this.getHomeCatalog()
    let scoped = catalog

    if (!options.wholeHome) {
      const areaName = options.area || this.config.room

      if (areaName) {
        const areaId = await this.resolveHomeAreaId(areaName)
        const areaEntityIds = new Set(await this.getHomeAreaEntityIds(areaId))
        scoped = scoped.filter(entity => areaEntityIds.has(entity.entity_id))
      }
    }

    if (options.domain) {
      scoped = scoped.filter(entity => entity.domain === options.domain)
    }

    const query = this.normalizeHomeName(options.query)
    const ranked = scoped
      .map(entity => ({
        entity,
        score: this.scoreHomeEntity(query, entity),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit)

    // If the current-room search found nothing and the user did not explicitly
    // name an area, fall back to the whole home. This lets a natural name still
    // work when Home Assistant's area assignment is incomplete.
    if (ranked.length === 0 && !options.wholeHome && !options.area && this.config.room) {
      const global = catalog
        .filter(entity => !options.domain || entity.domain === options.domain)
        .map(entity => ({ entity, score: this.scoreHomeEntity(query, entity) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit)

      const entities = global.map(item => item.entity)
      const actions = await this.getHomeActionsForEntities(entities.map(entity => entity.entity_id))

      return { entities, actions }
    }

    const entities = ranked.map(item => item.entity)
    const actions = await this.getHomeActionsForEntities(entities.map(entity => entity.entity_id))

    return { entities, actions }
  }

  private scoreHomeEntity(query: string, entity: HomeCatalogEntity): number {
    if (!query) return 1

    const searchable = [
      entity.entity_id,
      entity.entity_id.split('.', 2)[1] ?? '',
      entity.friendly_name,
      ...entity.aliases,
      entity.device_name ?? '',
      entity.device_model ?? '',
      entity.device_class ?? '',
      entity.domain,
    ]
      .map(value => this.normalizeHomeName(value))
      .filter(Boolean)

    let best = 0

    for (const value of searchable) {
      if (value === query) {
        best = Math.max(best, 300)
        continue
      }

      if (value.includes(query)) {
        best = Math.max(best, 220)
      }

      if (query.includes(value) && value.length >= 3) {
        best = Math.max(best, 180)
      }

      const queryTokens = query.split(' ').filter(token => token.length >= 2)
      const valueTokens = new Set(value.split(' ').filter(token => token.length >= 2))
      const overlap = queryTokens.filter(token => valueTokens.has(token)).length

      if (overlap > 0) {
        const ratio = overlap / Math.max(queryTokens.length, 1)
        best = Math.max(best, 80 + Math.round(ratio * 80))
      }
    }

    if (best < 300) {
      best += this.learnedAliasScoreBoost(query, entity)
    }

    return best
  }

  private learnedAliasScoreBoost(query: string, entity: HomeCatalogEntity): number {
    if (!query || !this.homeLearningLoaded) return 0

    let bestBoost = 0

    for (const alias of this.homeLearningStore.aliases) {
      if (
        alias.entity_id !== entity.entity_id ||
        alias.normalized_phrase !== query ||
        alias.confidence < HOME_LEARNING_BOOST_CONFIDENCE
      ) {
        continue
      }

      if (alias.domain && alias.domain !== entity.domain) {
        continue
      }

      if (
        alias.area_name &&
        entity.area_name &&
        this.normalizeHomeName(alias.area_name) !== this.normalizeHomeName(entity.area_name)
      ) {
        continue
      }

      const boost =
        alias.confidence >= HOME_LEARNING_DIRECT_CONFIDENCE
          ? 250 * alias.confidence
          : 130 * alias.confidence

      bestBoost = Math.max(bestBoost, Math.round(boost))
    }

    return bestBoost
  }

  private emptyLearningStore(): HomeLearningStore {
    return {
      version: 2,
      aliases: [],
      preferences: [],
      tombstones: {},
      updated_at: 0,
    }
  }

  private safeFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }

  private safeNonNegativeInteger(value: unknown, fallback = 0): number {
    const numeric = this.safeFiniteNumber(value, fallback)
    return Math.max(0, Math.trunc(numeric))
  }

  private safeTimestamp(value: unknown, fallback: number): number {
    const numeric = this.safeFiniteNumber(value, fallback)
    return numeric > 0 ? numeric : fallback
  }

  private safeNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private isLearningMetric(value: unknown): value is LearnedNumericPreference['metric'] {
    return value === 'temperature' || value === 'volume_level' || value === 'brightness_pct'
  }

  private sanitizePreferenceValue(
    metric: LearnedNumericPreference['metric'],
    value: unknown,
  ): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null

    if (metric === 'volume_level') {
      return value >= 0 && value <= 1 ? value : null
    }

    if (metric === 'brightness_pct') {
      return value >= 0 && value <= 100 ? value : null
    }

    // Home Assistant climate targets vary by installation. These bounds are
    // deliberately broad enough for real HVAC use while rejecting corrupt data.
    return value >= 5 && value <= 40 ? value : null
  }

  private createLearningEvidenceId(prefix: string): string {
    this.learningEventCounter = (this.learningEventCounter + 1) % Number.MAX_SAFE_INTEGER

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}:${crypto.randomUUID()}`
    }

    return `${prefix}:${Date.now().toString(36)}:${this.learningEventCounter.toString(36)}:${Math.random()
      .toString(36)
      .slice(2)}`
  }

  private sanitizeAliasEvidence(
    value: unknown,
    fallbackId: string,
    fallbackUpdatedAt: number,
    legacySource?: Partial<LearnedEntityAlias>,
  ): LearnedAliasEvidence[] {
    const result: LearnedAliasEvidence[] = []

    if (Array.isArray(value)) {
      for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue
        const item = raw as Record<string, unknown>
        const id = typeof item.id === 'string' && item.id ? item.id : ''
        const at = this.safeTimestamp(item.at, fallbackUpdatedAt)
        const kind = item.kind

        if (
          id &&
          (kind === 'discovery' ||
            kind === 'successful_status' ||
            kind === 'successful_action' ||
            kind === 'explicit_learning' ||
            kind === 'explicit_correction')
        ) {
          result.push({ id, kind, at })
          continue
        }

        if (id && kind === 'contradiction') {
          result.push({
            id,
            kind,
            at,
            severity: item.severity === 'explicit_correction' ? 'explicit_correction' : 'normal',
          })
          continue
        }

        if (id && kind === 'legacy_snapshot') {
          result.push({
            id,
            kind,
            at,
            confidence: this.clampConfidence(this.safeFiniteNumber(item.confidence, 0)),
            observations: this.safeNonNegativeInteger(item.observations),
            successful_uses: this.safeNonNegativeInteger(item.successful_uses),
            contradictions: this.safeNonNegativeInteger(item.contradictions),
            last_used_at:
              item.last_used_at === null || item.last_used_at === undefined
                ? null
                : this.safeTimestamp(item.last_used_at, at),
          })
        }
      }
    }

    if (result.length === 0 && legacySource) {
      result.push({
        id: `legacy-alias:${fallbackId}:${fallbackUpdatedAt}`,
        kind: 'legacy_snapshot',
        at: fallbackUpdatedAt,
        confidence: this.clampConfidence(this.safeFiniteNumber(legacySource.confidence, 0)),
        observations: this.safeNonNegativeInteger(legacySource.observations),
        successful_uses: this.safeNonNegativeInteger(legacySource.successful_uses),
        contradictions: this.safeNonNegativeInteger(legacySource.contradictions),
        last_used_at:
          legacySource.last_used_at === null || legacySource.last_used_at === undefined
            ? null
            : this.safeTimestamp(legacySource.last_used_at, fallbackUpdatedAt),
      })
    }

    return this.dedupeAliasEvidence(result)
  }

  private sanitizePreferenceEvidence(
    value: unknown,
    fallbackId: string,
    metric: LearnedNumericPreference['metric'],
    fallbackUpdatedAt: number,
    legacySource?: Partial<LearnedNumericPreference>,
  ): LearnedPreferenceEvidence[] {
    const result: LearnedPreferenceEvidence[] = []

    if (Array.isArray(value)) {
      for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue
        const item = raw as Record<string, unknown>
        const id = typeof item.id === 'string' && item.id ? item.id : ''
        const at = this.safeTimestamp(item.at, fallbackUpdatedAt)
        const kind = item.kind
        const numericValue = this.sanitizePreferenceValue(metric, item.value)

        if (
          id &&
          numericValue !== null &&
          (kind === 'implicit' || kind === 'explicit' || kind === 'correction')
        ) {
          result.push({ id, kind, at, value: numericValue })
          continue
        }

        if (id && kind === 'legacy_snapshot' && numericValue !== null) {
          result.push({
            id,
            kind,
            at,
            value: numericValue,
            confidence: this.clampConfidence(this.safeFiniteNumber(item.confidence, 0)),
            observations: this.safeNonNegativeInteger(item.observations),
            last_used_at:
              item.last_used_at === null || item.last_used_at === undefined
                ? null
                : this.safeTimestamp(item.last_used_at, at),
          })
        }
      }
    }

    if (result.length === 0 && legacySource) {
      const numericValue = this.sanitizePreferenceValue(metric, legacySource.value)

      if (numericValue !== null) {
        result.push({
          id: `legacy-preference:${fallbackId}:${fallbackUpdatedAt}`,
          kind: 'legacy_snapshot',
          at: fallbackUpdatedAt,
          value: numericValue,
          confidence: this.clampConfidence(this.safeFiniteNumber(legacySource.confidence, 0)),
          observations: this.safeNonNegativeInteger(legacySource.observations),
          last_used_at:
            legacySource.last_used_at === null || legacySource.last_used_at === undefined
              ? null
              : this.safeTimestamp(legacySource.last_used_at, fallbackUpdatedAt),
        })
      }
    }

    return this.dedupePreferenceEvidence(result)
  }

  private compareLearningEvidence(
    left: { id: string; kind: string; at: number },
    right: { id: string; kind: string; at: number },
  ): number {
    if (left.at !== right.at) return left.at - right.at

    const leftLegacy = left.kind === 'legacy_snapshot'
    const rightLegacy = right.kind === 'legacy_snapshot'
    if (leftLegacy !== rightLegacy) return leftLegacy ? -1 : 1

    return left.id.localeCompare(right.id)
  }

  private dedupeAliasEvidence(evidence: LearnedAliasEvidence[]): LearnedAliasEvidence[] {
    const byId = new Map<string, LearnedAliasEvidence>()

    for (const item of evidence) {
      const current = byId.get(item.id)
      if (!current || item.at >= current.at) byId.set(item.id, item)
    }

    return [...byId.values()].sort((a, b) => this.compareLearningEvidence(a, b))
  }

  private dedupePreferenceEvidence(
    evidence: LearnedPreferenceEvidence[],
  ): LearnedPreferenceEvidence[] {
    const byId = new Map<string, LearnedPreferenceEvidence>()

    for (const item of evidence) {
      const current = byId.get(item.id)
      if (!current || item.at >= current.at) byId.set(item.id, item)
    }

    return [...byId.values()].sort((a, b) => this.compareLearningEvidence(a, b))
  }

  private rebuildAliasFromEvidence(alias: LearnedEntityAlias): LearnedEntityAlias {
    const evidence = this.dedupeAliasEvidence(alias.evidence)
    let confidence = 0
    let observations = 0
    let successfulUses = 0
    let contradictions = 0
    let lastUsedAt: number | null = null
    let initialized = false

    for (const item of evidence) {
      if (item.kind === 'legacy_snapshot') {
        confidence = item.confidence
        observations = Math.max(observations, item.observations)
        successfulUses = Math.max(successfulUses, item.successful_uses)
        contradictions = Math.max(contradictions, item.contradictions)
        lastUsedAt = item.last_used_at ?? lastUsedAt
        initialized = true
        continue
      }

      if (item.kind === 'contradiction') {
        contradictions += 1
        confidence = this.clampConfidence(
          confidence * (item.severity === 'explicit_correction' ? 0.25 : 0.55),
        )
        initialized = true
        continue
      }

      observations += 1

      if (!initialized) {
        confidence =
          item.kind === 'explicit_correction'
            ? 0.92
            : item.kind === 'explicit_learning'
              ? 0.84
              : item.kind === 'successful_action'
                ? 0.62
                : item.kind === 'successful_status'
                  ? 0.5
                  : 0.34
        initialized = true
      } else if (item.kind === 'explicit_correction' || item.kind === 'explicit_learning') {
        confidence = Math.max(
          item.kind === 'explicit_correction' ? 0.92 : 0.84,
          this.clampConfidence(confidence + (1 - confidence) * 0.3),
        )
      } else if (item.kind === 'successful_action') {
        confidence = Math.max(0.62, this.clampConfidence(confidence + (1 - confidence) * 0.18))
      } else if (item.kind === 'successful_status') {
        confidence = Math.max(
          0.5,
          Math.min(0.78, this.clampConfidence(confidence + (1 - confidence) * 0.1)),
        )
      } else {
        confidence = Math.max(
          0.34,
          Math.min(0.68, this.clampConfidence(confidence + (1 - confidence) * 0.06)),
        )
      }

      if (
        item.kind === 'successful_action' ||
        item.kind === 'explicit_learning' ||
        item.kind === 'explicit_correction'
      ) {
        successfulUses += 1
        lastUsedAt = Math.max(lastUsedAt ?? 0, item.at)
      } else if (item.kind === 'successful_status') {
        lastUsedAt = Math.max(lastUsedAt ?? 0, item.at)
      }
    }

    const firstAt = evidence[0]?.at ?? alias.created_at
    const lastAt = evidence[evidence.length - 1]?.at ?? alias.updated_at

    return {
      ...alias,
      confidence: this.clampConfidence(confidence),
      observations,
      successful_uses: successfulUses,
      contradictions,
      created_at: Math.min(alias.created_at || firstAt, firstAt),
      updated_at: Math.max(alias.updated_at || lastAt, lastAt),
      last_used_at: lastUsedAt,
      evidence,
    }
  }

  private rebuildPreferenceFromEvidence(
    preference: LearnedNumericPreference,
  ): LearnedNumericPreference {
    const evidence = this.dedupePreferenceEvidence(preference.evidence)
    let value = preference.value
    let confidence = 0
    let observations = 0
    let lastUsedAt: number | null = null
    let initialized = false

    for (const item of evidence) {
      if (item.kind === 'legacy_snapshot') {
        value = item.value
        confidence = item.confidence
        observations = Math.max(observations, item.observations)
        lastUsedAt = item.last_used_at ?? lastUsedAt
        initialized = true
        continue
      }

      observations += 1
      lastUsedAt = Math.max(lastUsedAt ?? 0, item.at)

      if (!initialized) {
        value = item.value
        confidence = item.kind === 'correction' ? 0.88 : item.kind === 'explicit' ? 0.76 : 0.35
        initialized = true
        continue
      }

      if (item.kind === 'correction') {
        value = item.value
        confidence = 0.88
        continue
      }

      const tolerance =
        preference.metric === 'temperature'
          ? 1.0
          : preference.metric === 'brightness_pct'
            ? 12
            : 0.12
      const distance = Math.abs(item.value - value)
      const consistent = distance <= tolerance

      if (consistent) {
        value = value * 0.72 + item.value * 0.28
        confidence = this.clampConfidence(confidence + (1 - confidence) * 0.16)
      } else {
        value = value * 0.45 + item.value * 0.55
        confidence = this.clampConfidence(Math.max(0.24, confidence * 0.72))
      }

      if (item.kind === 'explicit') {
        confidence = Math.max(confidence, 0.76)
      }
    }

    const firstAt = evidence[0]?.at ?? preference.created_at
    const lastAt = evidence[evidence.length - 1]?.at ?? preference.updated_at

    return {
      ...preference,
      value,
      confidence: this.clampConfidence(confidence),
      observations,
      created_at: Math.min(preference.created_at || firstAt, firstAt),
      updated_at: Math.max(preference.updated_at || lastAt, lastAt),
      last_used_at: lastUsedAt,
      evidence,
    }
  }

  private sanitizeLearningStore(value: unknown): HomeLearningStore {
    if (!value || typeof value !== 'object') {
      return this.emptyLearningStore()
    }

    const candidate = value as Record<string, unknown>
    const now = Date.now()
    const aliases: LearnedEntityAlias[] = []
    const preferences: LearnedNumericPreference[] = []
    const tombstones = this.sanitizeLearningTombstones(candidate.tombstones)

    if (Array.isArray(candidate.aliases)) {
      for (const raw of candidate.aliases) {
        if (!raw || typeof raw !== 'object') continue
        const item = raw as Partial<LearnedEntityAlias>
        if (typeof item.phrase !== 'string' || typeof item.entity_id !== 'string') continue

        const phrase = item.phrase.trim()
        const normalizedPhrase = this.normalizeHomeName(phrase)
        const entityId = item.entity_id.trim()
        if (!normalizedPhrase || !entityId) continue

        const areaName = this.safeNullableString(item.area_name)
        const domain = this.safeNullableString(item.domain)
        const id = this.learningAliasId(normalizedPhrase, areaName, domain, entityId)
        const createdAt = this.safeTimestamp(item.created_at, now)
        const updatedAt = this.safeTimestamp(item.updated_at, createdAt)
        const evidence = this.sanitizeAliasEvidence(item.evidence, id, updatedAt, item)

        aliases.push(
          this.rebuildAliasFromEvidence({
            id,
            phrase,
            normalized_phrase: normalizedPhrase,
            area_name: areaName,
            domain,
            entity_id: entityId,
            confidence: 0,
            observations: 0,
            successful_uses: 0,
            contradictions: 0,
            created_at: createdAt,
            updated_at: updatedAt,
            last_used_at: null,
            evidence,
          }),
        )
      }
    }

    if (Array.isArray(candidate.preferences)) {
      for (const raw of candidate.preferences) {
        if (!raw || typeof raw !== 'object') continue
        const item = raw as Partial<LearnedNumericPreference>
        if (!this.isLearningMetric(item.metric) || typeof item.entity_id !== 'string') continue

        const entityId = item.entity_id.trim()
        const numericValue = this.sanitizePreferenceValue(item.metric, item.value)
        if (!entityId || numericValue === null) continue

        const areaName = this.safeNullableString(item.area_name)
        const id = this.learningPreferenceId(item.metric, areaName, entityId)
        const createdAt = this.safeTimestamp(item.created_at, now)
        const updatedAt = this.safeTimestamp(item.updated_at, createdAt)
        const evidence = this.sanitizePreferenceEvidence(
          item.evidence,
          id,
          item.metric,
          updatedAt,
          item,
        )

        preferences.push(
          this.rebuildPreferenceFromEvidence({
            id,
            metric: item.metric,
            area_name: areaName,
            entity_id: entityId,
            value: numericValue,
            confidence: 0,
            observations: 0,
            created_at: createdAt,
            updated_at: updatedAt,
            last_used_at: null,
            evidence,
          }),
        )
      }
    }

    return this.mergeLearningStores(this.emptyLearningStore(), {
      version: 2,
      aliases,
      preferences,
      tombstones,
      updated_at: this.safeTimestamp(candidate.updated_at, 0),
    })
  }

  private hasLearningStorePayload(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false

    const candidate = value as Record<string, unknown>
    return (
      candidate.version === 2 ||
      Array.isArray(candidate.aliases) ||
      Array.isArray(candidate.preferences) ||
      (candidate.tombstones !== null &&
        typeof candidate.tombstones === 'object' &&
        !Array.isArray(candidate.tombstones))
    )
  }

  private async loadRemoteLearningStoreWithLegacyMigration(): Promise<{
    store: HomeLearningStore
    migratedLegacy: boolean
  }> {
    if (!this.hass) {
      return { store: this.emptyLearningStore(), migratedLegacy: false }
    }

    const currentResponse = await this.hass.callWS<FrontendUserDataResponse>({
      type: 'frontend/get_user_data',
      key: HOME_LEARNING_STORAGE_KEY,
    })

    if (this.hasLearningStorePayload(currentResponse?.value)) {
      return { store: this.sanitizeLearningStore(currentResponse.value), migratedLegacy: false }
    }

    try {
      const legacyResponse = await this.hass.callWS<FrontendUserDataResponse>({
        type: 'frontend/get_user_data',
        key: HOME_LEARNING_LEGACY_STORAGE_KEY,
      })

      if (this.hasLearningStorePayload(legacyResponse?.value)) {
        return { store: this.sanitizeLearningStore(legacyResponse.value), migratedLegacy: true }
      }
    } catch (error) {
      console.warn('[Home Voice Agent] Could not read legacy learning memory', error)
    }

    return { store: this.emptyLearningStore(), migratedLegacy: false }
  }

  private async refreshHomeLearningMemory(force: boolean): Promise<void> {
    if (!this.hass) return

    if (
      !force &&
      this.homeLearningLoaded &&
      Date.now() - this.homeLearningLastRefresh < HOME_LEARNING_REFRESH_MS
    ) {
      return
    }

    const before = JSON.stringify(this.homeLearningStore)
    let migratedLegacy = false

    try {
      const loaded = await this.loadRemoteLearningStoreWithLegacyMigration()
      const remote = loaded.store
      migratedLegacy = loaded.migratedLegacy
      this.homeLearningStore = this.mergeLearningStores(this.homeLearningStore, remote)
      this.homeLearningLoaded = true
      this.homeLearningLastRefresh = Date.now()
      this.homeLearningStorageMode = 'home_assistant'

      this.writeLearningFallback()
    } catch (error) {
      const fallback = this.readLearningFallback()
      this.homeLearningStore = this.mergeLearningStores(this.homeLearningStore, fallback)
      this.homeLearningLoaded = true
      this.homeLearningLastRefresh = Date.now()
      this.homeLearningStorageMode = 'local_fallback'
      this.writeLearningFallback()

      console.warn(
        '[Home Voice Agent] HA user-data memory unavailable; using local fallback',
        error,
      )
    }

    if (before !== JSON.stringify(this.homeLearningStore)) {
      this.scheduleActiveAgentLearningRefresh()
    }

    if (migratedLegacy) {
      // Persist the migrated snapshot under the v2 key. Older frontends can keep
      // touching v1 without corrupting the new evidence/tombstone representation.
      this.scheduleLearningSave()
    }
  }

  private readLearningFallback(): HomeLearningStore {
    try {
      const currentRaw = window.localStorage.getItem(HOME_LEARNING_LOCAL_STORAGE_KEY)

      if (currentRaw) {
        return this.sanitizeLearningStore(JSON.parse(currentRaw))
      }

      const legacyRaw = window.localStorage.getItem(HOME_LEARNING_LEGACY_LOCAL_STORAGE_KEY)
      if (!legacyRaw) return this.emptyLearningStore()

      return this.sanitizeLearningStore(JSON.parse(legacyRaw))
    } catch {
      return this.emptyLearningStore()
    }
  }

  private writeLearningFallback(): void {
    try {
      window.localStorage.setItem(
        HOME_LEARNING_LOCAL_STORAGE_KEY,
        JSON.stringify(this.homeLearningStore),
      )
    } catch (error) {
      console.warn('[Home Voice Agent] Could not write local learning fallback', error)
    }
  }

  private sanitizeLearningTombstones(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    const entries: Array<[string, number]> = []

    for (const [key, rawTimestamp] of Object.entries(value as Record<string, unknown>)) {
      const validAliasKey = key.startsWith('alias:') && key.length > 'alias:'.length
      const validPreferenceKey = key.startsWith('preference:') && key.length > 'preference:'.length

      if (!validAliasKey && !validPreferenceKey) continue

      if (typeof rawTimestamp !== 'number' || !Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
        continue
      }

      entries.push([key, rawTimestamp])
    }

    return Object.fromEntries(
      entries
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, HOME_LEARNING_MAX_TOMBSTONES),
    )
  }

  private learningTombstoneKey(kind: 'alias' | 'preference', id: string): string {
    return `${kind}:${id}`
  }

  private learningTombstoneTimestamp(
    kind: 'alias' | 'preference',
    id: string,
    tombstones: Record<string, number> = this.homeLearningStore.tombstones,
  ): number {
    return tombstones[this.learningTombstoneKey(kind, id)] ?? 0
  }

  private markLearningTombstone(kind: 'alias' | 'preference', id: string, at = Date.now()): void {
    const key = this.learningTombstoneKey(kind, id)
    const existing = this.homeLearningStore.tombstones[key] ?? 0
    this.homeLearningStore.tombstones[key] = Math.max(existing, at)
    this.homeLearningStore.tombstones = this.sanitizeLearningTombstones(
      this.homeLearningStore.tombstones,
    )
  }

  private nextLearningMutationTimestamp(kind: 'alias' | 'preference', id: string): number {
    return Math.max(Date.now(), this.learningTombstoneTimestamp(kind, id) + 1)
  }

  private mergeLearningStores(
    left: HomeLearningStore,
    right: HomeLearningStore,
  ): HomeLearningStore {
    const aliases = new Map<string, LearnedEntityAlias>()
    const preferences = new Map<string, LearnedNumericPreference>()
    const tombstones: Record<string, number> = { ...left.tombstones }

    for (const [key, timestamp] of Object.entries(right.tombstones)) {
      tombstones[key] = Math.max(tombstones[key] ?? 0, timestamp)
    }

    for (const incoming of [...left.aliases, ...right.aliases]) {
      const current = aliases.get(incoming.id)

      if (!current) {
        aliases.set(incoming.id, this.rebuildAliasFromEvidence({ ...incoming }))
        continue
      }

      const newer = incoming.updated_at >= current.updated_at ? incoming : current
      aliases.set(
        incoming.id,
        this.rebuildAliasFromEvidence({
          ...current,
          phrase: newer.phrase,
          created_at: Math.min(current.created_at, incoming.created_at),
          updated_at: Math.max(current.updated_at, incoming.updated_at),
          evidence: this.dedupeAliasEvidence([...current.evidence, ...incoming.evidence]),
        }),
      )
    }

    for (const incoming of [...left.preferences, ...right.preferences]) {
      const current = preferences.get(incoming.id)

      if (!current) {
        preferences.set(incoming.id, this.rebuildPreferenceFromEvidence({ ...incoming }))
        continue
      }

      preferences.set(
        incoming.id,
        this.rebuildPreferenceFromEvidence({
          ...current,
          created_at: Math.min(current.created_at, incoming.created_at),
          updated_at: Math.max(current.updated_at, incoming.updated_at),
          evidence: this.dedupePreferenceEvidence([...current.evidence, ...incoming.evidence]),
        }),
      )
    }

    let aliasValues = [...aliases.values()]
      .filter(
        alias => (tombstones[this.learningTombstoneKey('alias', alias.id)] ?? 0) < alias.updated_at,
      )
      .sort((a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at)

    let preferenceValues = [...preferences.values()]
      .filter(
        preference =>
          (tombstones[this.learningTombstoneKey('preference', preference.id)] ?? 0) <
          preference.updated_at,
      )
      .sort((a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at)

    if (aliasValues.length > HOME_LEARNING_MAX_ALIASES) {
      for (const alias of aliasValues.slice(HOME_LEARNING_MAX_ALIASES)) {
        const key = this.learningTombstoneKey('alias', alias.id)
        tombstones[key] = Math.max(tombstones[key] ?? 0, alias.updated_at)
      }
      aliasValues = aliasValues.slice(0, HOME_LEARNING_MAX_ALIASES)
    }

    if (preferenceValues.length > HOME_LEARNING_MAX_PREFERENCES) {
      for (const preference of preferenceValues.slice(HOME_LEARNING_MAX_PREFERENCES)) {
        const key = this.learningTombstoneKey('preference', preference.id)
        tombstones[key] = Math.max(tombstones[key] ?? 0, preference.updated_at)
      }
      preferenceValues = preferenceValues.slice(0, HOME_LEARNING_MAX_PREFERENCES)
    }

    return {
      version: 2,
      aliases: aliasValues,
      preferences: preferenceValues,
      tombstones: this.sanitizeLearningTombstones(tombstones),
      updated_at: Math.max(left.updated_at, right.updated_at),
    }
  }

  private learningStoreContainsEvidence(
    haystack: HomeLearningStore,
    needle: HomeLearningStore,
  ): boolean {
    const aliasEvidence = new Map(
      haystack.aliases.map(alias => [alias.id, new Set(alias.evidence.map(item => item.id))]),
    )
    const preferenceEvidence = new Map(
      haystack.preferences.map(preference => [
        preference.id,
        new Set(preference.evidence.map(item => item.id)),
      ]),
    )

    const containsTombstones = Object.entries(needle.tombstones).every(
      ([key, timestamp]) => (haystack.tombstones[key] ?? 0) >= timestamp,
    )

    return (
      containsTombstones &&
      needle.aliases.every(alias => {
        const tombstone = haystack.tombstones[this.learningTombstoneKey('alias', alias.id)] ?? 0
        if (tombstone >= alias.updated_at) return true
        return alias.evidence.every(item => aliasEvidence.get(alias.id)?.has(item.id) === true)
      }) &&
      needle.preferences.every(preference => {
        const tombstone =
          haystack.tombstones[this.learningTombstoneKey('preference', preference.id)] ?? 0
        if (tombstone >= preference.updated_at) return true
        return preference.evidence.every(
          item => preferenceEvidence.get(preference.id)?.has(item.id) === true,
        )
      })
    )
  }

  private scheduleLearningSave(): void {
    this.homeLearningStore.updated_at = Date.now()
    this.writeLearningFallback()
    this.scheduleActiveAgentLearningRefresh()

    if (this.homeLearningSaveTimer !== null) {
      window.clearTimeout(this.homeLearningSaveTimer)
    }

    this.homeLearningSaveTimer = window.setTimeout(() => {
      this.homeLearningSaveTimer = null
      void this.persistLearningMemory()
    }, HOME_LEARNING_SAVE_DEBOUNCE_MS)
  }

  private async persistLearningMemory(): Promise<void> {
    this.homeLearningPersistRequested = true

    if (this.homeLearningPersistPromise) {
      await this.homeLearningPersistPromise
      return
    }

    this.homeLearningPersistPromise = (async () => {
      let attempts = 0

      while (this.homeLearningPersistRequested && attempts < 3) {
        this.homeLearningPersistRequested = false
        attempts += 1
        await this.persistLearningMemoryOnce()
      }

      if (this.homeLearningPersistRequested) {
        this.homeLearningPersistRequested = false
        window.setTimeout(
          () => {
            void this.persistLearningMemory()
          },
          250 + Math.floor(Math.random() * 250),
        )
      }
    })()

    try {
      await this.homeLearningPersistPromise
    } finally {
      this.homeLearningPersistPromise = null

      if (this.homeLearningPersistRequested) {
        void this.persistLearningMemory()
      }
    }
  }

  private async persistLearningMemoryOnce(): Promise<void> {
    if (!this.hass) return

    this.homeLearningStore.updated_at = Date.now()
    this.writeLearningFallback()
    const localSnapshot = this.sanitizeLearningStore(this.homeLearningStore)

    try {
      let remote = this.emptyLearningStore()

      try {
        const response = await this.hass.callWS<FrontendUserDataResponse>({
          type: 'frontend/get_user_data',
          key: HOME_LEARNING_STORAGE_KEY,
        })
        remote = this.sanitizeLearningStore(response?.value)
      } catch {
        // The write below will determine whether HA user-data storage is available.
      }

      const merged = this.mergeLearningStores(remote, localSnapshot)
      merged.updated_at = Date.now()

      await this.hass.callWS({
        type: 'frontend/set_user_data',
        key: HOME_LEARNING_STORAGE_KEY,
        value: merged,
      })

      // Verify the write. A second tablet can race between our read and write;
      // evidence IDs make that detectable and a later iteration converges safely.
      let verified = merged

      try {
        const response = await this.hass.callWS<FrontendUserDataResponse>({
          type: 'frontend/get_user_data',
          key: HOME_LEARNING_STORAGE_KEY,
        })
        verified = this.sanitizeLearningStore(response?.value)
      } catch {
        // Keep the just-written merged view if verification is temporarily unavailable.
      }

      this.homeLearningStore = this.mergeLearningStores(this.homeLearningStore, verified)
      this.homeLearningLoaded = true
      this.homeLearningLastRefresh = Date.now()
      this.homeLearningStorageMode = 'home_assistant'
      this.writeLearningFallback()

      if (!this.learningStoreContainsEvidence(verified, localSnapshot)) {
        this.homeLearningPersistRequested = true
      }
    } catch (error) {
      this.homeLearningStorageMode = 'local_fallback'
      console.warn('[Home Voice Agent] Could not persist learning memory in Home Assistant', error)
    }
  }

  private async observeLearnedAlias(options: {
    phrase: string
    areaName: string | null
    domain: string | null
    entityId: string
    evidence: LearnedAliasEvidenceKind
  }): Promise<void> {
    const phrase = options.phrase.trim()
    const normalized = this.normalizeHomeName(phrase)

    if (!normalized || normalized.length < 2) return

    await this.refreshHomeLearningMemory(false)

    const areaName = options.areaName?.trim() || null
    const id = this.learningAliasId(normalized, areaName, options.domain, options.entityId)
    const now = this.nextLearningMutationTimestamp('alias', id)

    if (
      options.evidence === 'successful_action' ||
      options.evidence === 'explicit_learning' ||
      options.evidence === 'explicit_correction'
    ) {
      for (const alias of this.homeLearningStore.aliases) {
        if (
          alias.id !== id &&
          alias.normalized_phrase === normalized &&
          this.sameLearningScope(alias.area_name, areaName, alias.domain, options.domain) &&
          alias.entity_id !== options.entityId
        ) {
          alias.evidence.push({
            id: this.createLearningEvidenceId('alias-contradiction'),
            kind: 'contradiction',
            at: now,
            severity: options.evidence === 'explicit_correction' ? 'explicit_correction' : 'normal',
          })
          Object.assign(alias, this.rebuildAliasFromEvidence(alias))
        }
      }
    }

    let alias = this.homeLearningStore.aliases.find(item => item.id === id)

    if (!alias) {
      alias = {
        id,
        phrase,
        normalized_phrase: normalized,
        area_name: areaName,
        domain: options.domain,
        entity_id: options.entityId,
        confidence: 0,
        observations: 0,
        successful_uses: 0,
        contradictions: 0,
        created_at: now,
        updated_at: now,
        last_used_at: null,
        evidence: [],
      }
      this.homeLearningStore.aliases.push(alias)
    }

    alias.phrase = phrase
    alias.evidence.push({
      id: this.createLearningEvidenceId(`alias-${options.evidence}`),
      kind: options.evidence,
      at: now,
    })
    Object.assign(alias, this.rebuildAliasFromEvidence(alias))

    this.trimLearningMemory()
    this.scheduleLearningSave()
  }

  private async observeNumericPreference(options: {
    metric: LearnedNumericPreference['metric']
    value: number
    areaName: string | null
    entityId: string
    evidence?: 'implicit' | 'explicit' | 'correction'
  }): Promise<void> {
    const value = this.sanitizePreferenceValue(options.metric, options.value)
    if (value === null) return

    await this.refreshHomeLearningMemory(false)

    const areaName = options.areaName?.trim() || null
    const id = this.learningPreferenceId(options.metric, areaName, options.entityId)
    const now = this.nextLearningMutationTimestamp('preference', id)
    let preference = this.homeLearningStore.preferences.find(item => item.id === id)

    if (!preference) {
      preference = {
        id,
        metric: options.metric,
        area_name: areaName,
        entity_id: options.entityId,
        value,
        confidence: 0,
        observations: 0,
        created_at: now,
        updated_at: now,
        last_used_at: null,
        evidence: [],
      }
      this.homeLearningStore.preferences.push(preference)
    }

    const evidenceKind = options.evidence ?? 'implicit'
    preference.evidence.push({
      id: this.createLearningEvidenceId(`preference-${evidenceKind}`),
      kind: evidenceKind,
      at: now,
      value,
    })
    Object.assign(preference, this.rebuildPreferenceFromEvidence(preference))

    this.trimLearningMemory()
    this.scheduleLearningSave()
  }

  private learningAliasId(
    normalizedPhrase: string,
    areaName: string | null,
    domain: string | null,
    entityId: string,
  ): string {
    return [
      'alias',
      normalizedPhrase,
      this.normalizeHomeName(areaName || '*'),
      domain || '*',
      entityId,
    ].join('|')
  }

  private learningPreferenceId(
    metric: LearnedNumericPreference['metric'],
    areaName: string | null,
    entityId: string,
  ): string {
    return ['preference', metric, this.normalizeHomeName(areaName || '*'), entityId].join('|')
  }

  private sameLearningScope(
    leftArea: string | null,
    rightArea: string | null,
    leftDomain: string | null,
    rightDomain: string | null,
  ): boolean {
    return (
      this.normalizeHomeName(leftArea || '*') === this.normalizeHomeName(rightArea || '*') &&
      (leftDomain || '*') === (rightDomain || '*')
    )
  }

  private clampConfidence(value: number): number {
    return Math.max(0, Math.min(0.99, value))
  }

  private trimLearningMemory(): void {
    const aliases = [...this.homeLearningStore.aliases].sort(
      (a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at,
    )
    const preferences = [...this.homeLearningStore.preferences].sort(
      (a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at,
    )

    for (const alias of aliases.slice(HOME_LEARNING_MAX_ALIASES)) {
      this.markLearningTombstone('alias', alias.id, alias.updated_at)
    }

    for (const preference of preferences.slice(HOME_LEARNING_MAX_PREFERENCES)) {
      this.markLearningTombstone('preference', preference.id, preference.updated_at)
    }

    this.homeLearningStore.aliases = aliases.slice(0, HOME_LEARNING_MAX_ALIASES)
    this.homeLearningStore.preferences = preferences.slice(0, HOME_LEARNING_MAX_PREFERENCES)
  }

  private async reconcileLearningMemoryWithCatalog(catalog: HomeCatalogEntity[]): Promise<void> {
    if (!this.homeLearningLoaded) {
      await this.refreshHomeLearningMemory(false)
    }

    if (!this.homeLearningLoaded || catalog.length === 0) return

    const entityIds = new Set(catalog.map(entity => entity.entity_id))
    const learnedEntityIds = new Set([
      ...this.homeLearningStore.aliases.map(alias => alias.entity_id),
      ...this.homeLearningStore.preferences.map(preference => preference.entity_id),
    ])

    for (const entityId of learnedEntityIds) {
      if (entityIds.has(entityId)) {
        this.homeLearningMissingCatalogCounts.delete(entityId)
      } else {
        this.homeLearningMissingCatalogCounts.set(
          entityId,
          (this.homeLearningMissingCatalogCounts.get(entityId) ?? 0) + 1,
        )
      }
    }

    const staleEntityIds = new Set(
      [...this.homeLearningMissingCatalogCounts.entries()]
        .filter(([, misses]) => misses >= HOME_LEARNING_STALE_REFRESH_LIMIT)
        .map(([entityId]) => entityId),
    )

    if (staleEntityIds.size === 0) return

    const aliasesBefore = this.homeLearningStore.aliases.length
    const preferencesBefore = this.homeLearningStore.preferences.length

    const removedAt = Date.now()

    for (const alias of this.homeLearningStore.aliases) {
      if (staleEntityIds.has(alias.entity_id)) {
        this.markLearningTombstone('alias', alias.id, Math.max(removedAt, alias.updated_at))
      }
    }

    for (const preference of this.homeLearningStore.preferences) {
      if (staleEntityIds.has(preference.entity_id)) {
        this.markLearningTombstone(
          'preference',
          preference.id,
          Math.max(removedAt, preference.updated_at),
        )
      }
    }

    this.homeLearningStore.aliases = this.homeLearningStore.aliases.filter(
      alias => !staleEntityIds.has(alias.entity_id),
    )
    this.homeLearningStore.preferences = this.homeLearningStore.preferences.filter(
      preference => !staleEntityIds.has(preference.entity_id),
    )

    for (const entityId of staleEntityIds) {
      this.homeLearningMissingCatalogCounts.delete(entityId)
    }

    if (
      aliasesBefore !== this.homeLearningStore.aliases.length ||
      preferencesBefore !== this.homeLearningStore.preferences.length
    ) {
      console.info('[Home Voice Agent] Removed persistently stale learned home references', {
        aliases: aliasesBefore - this.homeLearningStore.aliases.length,
        preferences: preferencesBefore - this.homeLearningStore.preferences.length,
        requiredConsecutiveMisses: HOME_LEARNING_STALE_REFRESH_LIMIT,
      })
      this.scheduleLearningSave()
    }
  }

  private async getHomeCatalog(): Promise<HomeCatalogEntity[]> {
    const stale =
      this.homeCatalogCache.length === 0 ||
      Date.now() - this.homeKnowledgeLastRefresh > HOME_KNOWLEDGE_REFRESH_MS

    if (stale) {
      await this.refreshHomeKnowledge('tool access')
    } else {
      this.syncHomeKnowledgeStatesFromHass()
    }

    return this.homeCatalogCache
  }

  private async refreshHomeKnowledge(reason: string): Promise<void> {
    if (!this.hass) return

    if (this.homeKnowledgeRefreshPromise) {
      await this.homeKnowledgeRefreshPromise
      return
    }

    this.homeKnowledgeRefreshPromise = (async () => {
      try {
        const catalog = await this.loadHomeCatalogSnapshot()

        this.homeCatalogCache = catalog
        this.homeKnowledgeLastRefresh = Date.now()
        this.homeKnowledgeVersion += 1

        await this.reconcileLearningMemoryWithCatalog(catalog)

        console.info('[Home Voice Agent] Home knowledge refreshed', {
          reason,
          entities: catalog.length,
          version: this.homeKnowledgeVersion,
        })
      } catch (error) {
        console.warn('[Home Voice Agent] Could not refresh home knowledge', {
          reason,
          error,
        })
      } finally {
        this.homeKnowledgeRefreshPromise = null
      }
    })()

    await this.homeKnowledgeRefreshPromise
  }

  private scheduleHomeKnowledgeRefresh(reason: string): void {
    if (this.homeKnowledgeDebounceTimer !== null) {
      window.clearTimeout(this.homeKnowledgeDebounceTimer)
    }

    this.homeKnowledgeDebounceTimer = window.setTimeout(() => {
      this.homeKnowledgeDebounceTimer = null
      void this.refreshHomeKnowledge(reason)
    }, HOME_KNOWLEDGE_DEBOUNCE_MS)
  }

  private startHomeKnowledgeRefreshTimer(): void {
    if (this.homeKnowledgeRefreshTimer !== null) return

    const tick = () => {
      this.homeKnowledgeRefreshTimer = window.setTimeout(() => {
        void this.refreshHomeKnowledge('periodic fallback').finally(tick)
      }, HOME_KNOWLEDGE_REFRESH_MS)
    }

    tick()
  }

  private syncHomeKnowledgeStatesFromHass(): void {
    const states = this.hass?.states

    if (!states || this.homeCatalogCache.length === 0) return

    const cacheIds = new Set(this.homeCatalogCache.map(entity => entity.entity_id))
    const stateIds = Object.keys(states)

    if (stateIds.length !== cacheIds.size || stateIds.some(entityId => !cacheIds.has(entityId))) {
      this.scheduleHomeKnowledgeRefresh('entity set changed')
    }

    for (const entity of this.homeCatalogCache) {
      const state = states[entity.entity_id]

      if (!state) continue

      entity.state = state.state

      if (typeof state.attributes?.friendly_name === 'string') {
        entity.friendly_name = state.attributes.friendly_name
      }

      entity.device_class =
        typeof state.attributes?.device_class === 'string'
          ? state.attributes.device_class
          : entity.device_class

      entity.supported_features =
        typeof state.attributes?.supported_features === 'number'
          ? state.attributes.supported_features
          : entity.supported_features
    }
  }

  private async bindHomeKnowledgeSubscriptions(connection: HassConnectionLike): Promise<void> {
    await this.clearHomeKnowledgeSubscriptions()

    this.homeKnowledgeConnection = connection

    const subscribe = async (eventType: string, callback: (event: HassEvent<any>) => void) => {
      try {
        const unsubscribe = await connection.subscribeEvents(callback, eventType)
        this.homeKnowledgeUnsubscribers.push(unsubscribe)
      } catch (error) {
        console.warn('[Home Voice Agent] Could not subscribe to Home Assistant event', {
          eventType,
          error,
        })
      }
    }

    await Promise.all([
      subscribe('state_changed', event => this.handleHomeStateChanged(event)),
      subscribe('entity_registry_updated', () =>
        this.scheduleHomeKnowledgeRefresh('entity registry changed'),
      ),
      subscribe('device_registry_updated', () =>
        this.scheduleHomeKnowledgeRefresh('device registry changed'),
      ),
      subscribe('area_registry_updated', () =>
        this.scheduleHomeKnowledgeRefresh('area registry changed'),
      ),
      subscribe('service_registered', () =>
        this.scheduleHomeKnowledgeRefresh('service registered'),
      ),
      subscribe('service_removed', () => this.scheduleHomeKnowledgeRefresh('service removed')),
    ])

    console.info('[Home Voice Agent] Home knowledge live sync active', {
      subscriptions: this.homeKnowledgeUnsubscribers.length,
    })
  }

  private async clearHomeKnowledgeSubscriptions(): Promise<void> {
    const unsubscribers = this.homeKnowledgeUnsubscribers.splice(0)

    await Promise.all(
      unsubscribers.map(unsubscribe =>
        unsubscribe().catch(error => {
          console.warn('[Home Voice Agent] Could not unsubscribe home knowledge event', error)
        }),
      ),
    )
  }

  private handleHomeStateChanged(event: HassEvent<any>): void {
    const entityId =
      event?.data && typeof event.data.entity_id === 'string' ? event.data.entity_id : null
    const newState = event?.data?.new_state as HassState | null | undefined

    if (!entityId) return

    const entity = this.homeCatalogCache.find(item => item.entity_id === entityId)

    if (!entity || !newState) {
      this.scheduleHomeKnowledgeRefresh('state entity added or removed')
      return
    }

    entity.state = newState.state

    if (typeof newState.attributes?.friendly_name === 'string') {
      entity.friendly_name = newState.attributes.friendly_name
    }

    if (typeof newState.attributes?.device_class === 'string') {
      entity.device_class = newState.attributes.device_class
    }

    if (typeof newState.attributes?.supported_features === 'number') {
      entity.supported_features = newState.attributes.supported_features
    }
  }

  private async loadHomeCatalogSnapshot(): Promise<HomeCatalogEntity[]> {
    const [states, areas, entityRegistry, deviceRegistry] = await Promise.all([
      this.getHomeStates(),
      this.getHomeAreas(),
      this.getHomeEntityRegistry(),
      this.getHomeDeviceRegistry(),
    ])

    const areaById = new Map(areas.map(area => [area.area_id, area]))
    const registryByEntity = new Map(entityRegistry.map(entry => [entry.entity_id, entry]))
    const deviceById = new Map(deviceRegistry.map(device => [device.id, device]))

    return states.map(state => {
      const registry = registryByEntity.get(state.entity_id)
      const device = registry?.device_id ? deviceById.get(registry.device_id) : undefined
      const areaId = registry?.area_id || device?.area_id || null
      const area = areaId ? areaById.get(areaId) : undefined
      const friendlyName =
        typeof state.attributes?.friendly_name === 'string'
          ? state.attributes.friendly_name
          : registry?.name || registry?.original_name || state.entity_id
      const aliases = [
        ...(Array.isArray(registry?.aliases) ? registry.aliases : []),
        registry?.name || '',
        registry?.original_name || '',
      ].filter((value): value is string => Boolean(value))
      const supportedFeatures = state.attributes?.supported_features

      const entity: HomeCatalogEntity = {
        entity_id: state.entity_id,
        domain: state.entity_id.split('.', 2)[0] ?? '',
        friendly_name: friendlyName,
        area_id: areaId,
        area_name: area?.name ?? null,
        aliases: [...new Set(aliases)],
        device_id: registry?.device_id ?? null,
        device_name: device?.name_by_user || device?.name || null,
        device_model: device?.model || device?.model_id || null,
        state: state.state,
        device_class:
          typeof state.attributes?.device_class === 'string' ? state.attributes.device_class : null,
        supported_features: typeof supportedFeatures === 'number' ? supportedFeatures : null,
        sensitive: false,
      }

      entity.sensitive = this.isSensitiveHomeEntity(entity)

      return entity
    })
  }

  private async getHomeEntityRegistry(): Promise<HomeEntityRegistryEntry[]> {
    if (!this.hass) {
      throw new Error('Home Assistant is not connected.')
    }

    try {
      const entities = await this.hass.callWS<HomeEntityRegistryEntry[]>({
        type: 'config/entity_registry/list',
      })

      return Array.isArray(entities) ? entities.filter(entity => !entity.disabled_by) : []
    } catch (error) {
      console.warn('[Home Voice Agent] Entity registry unavailable; using states only', error)
      return []
    }
  }

  private async getHomeDeviceRegistry(): Promise<HomeDeviceRegistryEntry[]> {
    if (!this.hass) {
      throw new Error('Home Assistant is not connected.')
    }

    try {
      const devices = await this.hass.callWS<HomeDeviceRegistryEntry[]>({
        type: 'config/device_registry/list',
      })

      return Array.isArray(devices) ? devices : []
    } catch (error) {
      console.warn(
        '[Home Voice Agent] Device registry unavailable; using entity metadata only',
        error,
      )
      return []
    }
  }

  private async getHomeActionsForEntities(entityIds: string[]): Promise<string[]> {
    if (!this.hass || entityIds.length === 0) {
      return []
    }

    try {
      const actions = await this.hass.callWS<string[]>({
        type: 'get_services_for_target',
        target: {
          entity_id: entityIds,
        },
        expand_group: true,
      })

      return Array.isArray(actions) ? [...new Set(actions)].sort() : []
    } catch (error) {
      console.warn('[Home Voice Agent] Could not load target actions', error)
      return []
    }
  }

  private async executeHomeSensitiveControl(args: HomeSensitiveControlArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    try {
      const now = Date.now()

      if (args.confirmation_token) {
        const pending = this.pendingSensitiveAction

        if (!pending || pending.token !== args.confirmation_token) {
          return JSON.stringify({
            ok: false,
            error: 'The sensitive-action confirmation token is invalid or no longer pending.',
          })
        }

        if (now > pending.expiresAt) {
          this.pendingSensitiveAction = null

          return JSON.stringify({
            ok: false,
            error: 'The sensitive-action confirmation expired. Prepare the action again.',
          })
        }

        if (this.userSpeechSequence < pending.requiredUserSpeechSequence) {
          return JSON.stringify({
            ok: false,
            requires_user_reply: true,
            error:
              'Do not execute yet. The user must give a new spoken confirmation after the confirmation question.',
          })
        }

        const confirmationSequence = this.userSpeechSequence
        const confirmationTranscript = await this.waitForUserSpeechTranscript(confirmationSequence)

        if (!confirmationTranscript) {
          return JSON.stringify({
            ok: false,
            requires_user_reply: true,
            error:
              'The spoken confirmation could not be verified from the input transcript. Ask the user to confirm again explicitly.',
          })
        }

        if (Date.now() > pending.expiresAt) {
          this.pendingSensitiveAction = null
          return JSON.stringify({
            ok: false,
            error: 'The sensitive-action confirmation expired. Prepare the action again.',
          })
        }

        if (!this.isExplicitSensitiveConfirmation(confirmationTranscript.transcript)) {
          this.pendingSensitiveAction = null

          return JSON.stringify({
            ok: false,
            rejected: true,
            executed: false,
            error: 'The user did not give an explicit affirmative confirmation.',
          })
        }

        await this.hass.callWS({
          type: 'call_service',
          domain: pending.domain,
          service: pending.service,
          service_data: {},
          target: {
            entity_id: pending.entityIds,
          },
        })

        const pendingEntityId = pending.entityIds[0]

        if (pending.entityIds.length === 1 && pendingEntityId && pending.learnedQuery) {
          await this.observeLearnedAlias({
            phrase: pending.learnedQuery,
            areaName: pending.area,
            domain: pending.domain,
            entityId: pendingEntityId,
            evidence: 'successful_action',
          })
        }

        this.pendingSensitiveAction = null

        console.info('[Home Voice Agent] Sensitive Home Assistant action executed', {
          domain: pending.domain,
          service: pending.service,
          action: pending.action,
          entityIds: pending.entityIds,
          label: pending.label,
        })

        return JSON.stringify({
          ok: true,
          confirmed: true,
          executed: true,
          action: pending.action,
          service: `${pending.domain}.${pending.service}`,
          targets: pending.entityIds,
          label: pending.label,
        })
      }

      const target = await this.resolveSensitiveHomeTarget(args.query, args.area)
      const service = this.serviceForSensitiveHomeAction(target.domain, args.action)
      const serviceId = `${target.domain}.${service}`
      const availableServices = await this.getHomeActionsForEntities([target.entity_id])

      if (availableServices.length > 0 && !availableServices.includes(serviceId)) {
        return JSON.stringify({
          ok: false,
          error: `The target does not expose ${serviceId}.`,
          target: {
            entity_id: target.entity_id,
            name: target.friendly_name,
            domain: target.domain,
          },
          available_actions: availableServices,
        })
      }

      const token = this.createSensitiveConfirmationToken()
      const ttlMs = 30_000

      this.pendingSensitiveAction = {
        token,
        createdAt: now,
        expiresAt: now + ttlMs,
        requiredUserSpeechSequence: this.userSpeechSequence + 1,
        entityIds: [target.entity_id],
        domain: target.domain,
        service,
        action: args.action,
        label: target.friendly_name,
        area: target.area_name,
        learnedQuery: args.query,
      }

      return JSON.stringify({
        ok: true,
        prepared: true,
        executed: false,
        requires_confirmation: true,
        confirmation_token: token,
        expires_in_seconds: ttlMs / 1000,
        action: args.action,
        service: serviceId,
        target: {
          entity_id: target.entity_id,
          name: target.friendly_name,
          area: target.area_name,
          domain: target.domain,
        },
        confirmation_prompt: this.sensitiveConfirmationPrompt(args.action, target.friendly_name),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      console.warn('[Home Voice Agent] Sensitive Home Assistant control failed', error)

      return JSON.stringify({ ok: false, error: message })
    }
  }

  private async resolveSensitiveHomeTarget(
    query: string,
    area: string | null,
  ): Promise<HomeCatalogEntity> {
    await this.refreshHomeLearningMemory(false)

    const catalog = await this.getHomeCatalog()
    const controllableDomains = new Set([
      'lock',
      'cover',
      'switch',
      'button',
      'input_button',
      'script',
      'automation',
      'alarm_control_panel',
    ])

    let candidates = catalog.filter(
      entity => entity.sensitive && controllableDomains.has(entity.domain),
    )

    if (area) {
      const areaId = await this.resolveHomeAreaId(area)
      const areaEntityIds = new Set(await this.getHomeAreaEntityIds(areaId))
      candidates = candidates.filter(entity => areaEntityIds.has(entity.entity_id))
    }

    const normalized = this.normalizeHomeName(query)
    const ranked = candidates
      .map(entity => ({ entity, score: this.scoreHomeEntity(normalized, entity) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)

    if (ranked.length === 0) {
      throw new Error(`No sensitive entity matching "${query}" was found.`)
    }

    const best = ranked[0]
    const second = ranked[1]

    if (best && best.score < 80) {
      throw new Error(`No reliable sensitive-entity match was found for "${query}".`)
    }

    if (best && second && best.score < 220 && best.score - second.score < 25) {
      const matches = ranked
        .slice(0, 6)
        .map(item => `${item.entity.friendly_name} (${item.entity.entity_id})`)

      throw new Error(
        `The sensitive target "${query}" is ambiguous. Matches: ${matches.join(', ')}`,
      )
    }

    return best?.entity!
  }

  private containsSensitiveHomeKeyword(value: string): boolean {
    const normalized = this.normalizeHomeName(value)
    const keywords = [
      'cancello',
      'gate',
      'garage',
      'portone',
      'porta di casa',
      'porta ingresso',
      'front door',
      'main door',
      'serratura',
      'lock',
      'allarme',
      'alarm',
      'antifurto',
      'basculante',
    ]

    return keywords.some(keyword => normalized.includes(this.normalizeHomeName(keyword)))
  }

  private isSensitiveHomeEntity(entity: HomeCatalogEntity): boolean {
    if (
      this.config.sensitiveEntityIds.includes(entity.entity_id) ||
      (entity.device_id !== null && this.config.sensitiveDeviceIds.includes(entity.device_id))
    ) {
      return true
    }

    if (entity.domain === 'lock' || entity.domain === 'alarm_control_panel') {
      return true
    }

    if (
      entity.domain === 'cover' &&
      ['door', 'garage', 'gate'].includes(this.normalizeHomeName(entity.device_class ?? ''))
    ) {
      return true
    }

    if (this.config.nonSensitiveEntityIds.includes(entity.entity_id)) {
      return false
    }

    const sensitiveDomains = new Set([
      'cover',
      'switch',
      'button',
      'input_button',
      'script',
      'automation',
    ])

    if (!sensitiveDomains.has(entity.domain)) {
      return false
    }

    return this.containsSensitiveHomeKeyword(
      [
        entity.entity_id,
        entity.friendly_name,
        ...entity.aliases,
        entity.device_name ?? '',
        entity.device_model ?? '',
      ].join(' '),
    )
  }

  private serviceForSensitiveHomeAction(domain: string, action: HomeSensitiveAction): string {
    const services: Record<string, Partial<Record<HomeSensitiveAction, string>>> = {
      lock: {
        lock: 'lock',
        unlock: 'unlock',
        open: 'open',
      },
      cover: {
        open: 'open_cover',
        close: 'close_cover',
      },
      switch: {
        turn_on: 'turn_on',
        turn_off: 'turn_off',
        open: 'turn_on',
        close: 'turn_off',
      },
      button: {
        press: 'press',
        open: 'press',
      },
      input_button: {
        press: 'press',
        open: 'press',
      },
      script: {
        trigger: 'turn_on',
        press: 'turn_on',
        open: 'turn_on',
      },
      automation: {
        trigger: 'trigger',
        press: 'trigger',
      },
      alarm_control_panel: {
        arm_home: 'alarm_arm_home',
        arm_away: 'alarm_arm_away',
        disarm: 'alarm_disarm',
      },
    }

    const service = services[domain]?.[action]

    if (!service) {
      throw new Error(`Sensitive action ${action} is not supported for domain ${domain}.`)
    }

    return service
  }

  private createSensitiveConfirmationToken(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }

  private sensitiveConfirmationPrompt(action: HomeSensitiveAction, label: string): string {
    const verbs: Record<HomeSensitiveAction, string> = {
      open: 'apro',
      close: 'chiudo',
      lock: 'blocco',
      unlock: 'sblocco',
      press: 'attivo',
      turn_on: 'attivo',
      turn_off: 'disattivo',
      trigger: 'avvio',
      arm_home: 'inserisco in modalità casa',
      arm_away: 'inserisco in modalità fuori casa',
      disarm: 'disinserisco',
    }

    return `Confermi che ${verbs[action]} ${label}?`
  }

  private async executeHomeControl(args: HomeControlArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    try {
      const service = this.serviceForHomeAction(args.domain, args.action)
      const entityIds = await this.resolveHomeTargets({
        domain: args.domain,
        area: args.area,
        entity: args.entity,
        wholeHome: args.whole_home,
      })

      const entityId = entityIds[0]

      if (entityIds.length === 0) {
        return JSON.stringify({
          ok: false,
          error: 'No matching Home Assistant entities were found for that target.',
        })
      }

      const catalog = await this.getHomeCatalog()
      const byId = new Map(catalog.map(entity => [entity.entity_id, entity]))
      const sensitiveTargets = entityIds
        .map(entityId => byId.get(entityId))
        .filter((entity): entity is HomeCatalogEntity => Boolean(entity?.sensitive))
      const sensitiveNaturalTarget = Boolean(
        args.entity && this.containsSensitiveHomeKeyword(args.entity),
      )
      const sensitiveDiscoveryHint = entityIds.some(targetId => {
        const hint = this.recentDiscoveryHints.get(targetId)
        return Boolean(
          hint && hint.expiresAt >= Date.now() && this.containsSensitiveHomeKeyword(hint.query),
        )
      })

      if (sensitiveTargets.length > 0 || sensitiveNaturalTarget || sensitiveDiscoveryHint) {
        return JSON.stringify({
          ok: false,
          sensitive: true,
          error:
            'This target or request is classified as sensitive. Use home_sensitive_control so a separately verified spoken confirmation is required.',
          targets: entityIds.map(targetId => {
            const entity = byId.get(targetId)
            return {
              entity_id: targetId,
              name: entity?.friendly_name ?? targetId,
              domain: entity?.domain ?? args.domain,
            }
          }),
        })
      }

      const serviceData: Record<string, unknown> = {}

      if (args.domain === 'climate' && args.action === 'set_temperature') {
        if (args.temperature === null || !Number.isFinite(args.temperature)) {
          return JSON.stringify({ ok: false, error: 'A target temperature is required.' })
        }

        serviceData.temperature = args.temperature
      }

      if (args.domain === 'light' && args.action === 'turn_on' && args.brightness_pct !== null) {
        serviceData.brightness_pct = Math.max(0, Math.min(100, args.brightness_pct))
      }

      if (args.domain === 'media_player' && args.action === 'set_volume') {
        if (args.volume_level === null || !Number.isFinite(args.volume_level)) {
          return JSON.stringify({ ok: false, error: 'A volume level is required.' })
        }

        serviceData.volume_level = Math.max(0, Math.min(1, args.volume_level))
      }

      if (args.domain === 'media_player' && (args.action === 'mute' || args.action === 'unmute')) {
        serviceData.is_volume_muted = args.action === 'mute'
      }

      await this.hass.callWS({
        type: 'call_service',
        domain: args.domain,
        service,
        service_data: serviceData,
        target: {
          entity_id: entityIds,
        },
      })

      console.info('[Home Voice Agent] Home Assistant action', {
        domain: args.domain,
        service,
        area: args.area,
        entity: args.entity,
        wholeHome: args.whole_home,
        entityIds,
      })

      if (entityIds.length === 1 && entityId) {
        const target = byId.get(entityId)
        const learnedArea =
          args.area || target?.area_name || (!args.whole_home ? this.config.room || null : null)

        const learnedAliasKeys = new Set<string>()
        const learnSuccessfulAlias = async (
          phrase: string,
          areaName: string | null,
          domain: string | null,
        ) => {
          const key = [
            this.normalizeHomeName(phrase),
            this.normalizeHomeName(areaName || '*'),
            domain || '*',
          ].join('|')

          if (!key || learnedAliasKeys.has(key)) return
          learnedAliasKeys.add(key)

          await this.observeLearnedAlias({
            phrase,
            areaName,
            domain,
            entityId,
            evidence: 'successful_action',
          })
        }

        if (args.entity) {
          await learnSuccessfulAlias(args.entity, learnedArea, args.domain)
        }

        const discoveryHint = this.recentDiscoveryHints.get(entityId)
        if (discoveryHint) {
          if (discoveryHint.expiresAt >= Date.now()) {
            await learnSuccessfulAlias(
              discoveryHint.query,
              discoveryHint.area || learnedArea,
              discoveryHint.domain || args.domain,
            )
          }

          this.recentDiscoveryHints.delete(entityId)
        }

        if (
          args.domain === 'climate' &&
          args.action === 'set_temperature' &&
          args.temperature !== null
        ) {
          await this.observeNumericPreference({
            metric: 'temperature',
            value: args.temperature,
            areaName: learnedArea,
            entityId,
          })
        }

        if (
          args.domain === 'media_player' &&
          args.action === 'set_volume' &&
          args.volume_level !== null
        ) {
          await this.observeNumericPreference({
            metric: 'volume_level',
            value: args.volume_level,
            areaName: learnedArea,
            entityId,
          })
        }

        if (args.domain === 'light' && args.action === 'turn_on' && args.brightness_pct !== null) {
          await this.observeNumericPreference({
            metric: 'brightness_pct',
            value: args.brightness_pct,
            areaName: learnedArea,
            entityId,
          })
        }
      }

      return JSON.stringify({
        ok: true,
        domain: args.domain,
        service,
        target_count: entityIds.length,
        targets: entityIds,
        area: args.area,
        entity: args.entity,
        whole_home: args.whole_home,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[Home Voice Agent] Home Assistant control failed', error)
      return JSON.stringify({ ok: false, error: message })
    }
  }

  private async executeHomeStatus(args: HomeStatusArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    try {
      const states = await this.getHomeStates()
      const requestedDomain = args.domain ?? undefined
      const entityIds = await this.resolveHomeTargets({
        domain: requestedDomain,
        area: args.area,
        entity: args.entity,
        wholeHome: args.whole_home,
      })

      const entityId = entityIds[0]

      const wanted = new Set(entityIds)

      if (args.entity && entityIds.length === 1 && entityId) {
        const catalog = await this.getHomeCatalog()
        const target = catalog.find(entity => entity.entity_id === entityId)

        await this.observeLearnedAlias({
          phrase: args.entity,
          areaName:
            args.area || target?.area_name || (!args.whole_home ? this.config.room || null : null),
          domain: args.domain || target?.domain || null,
          entityId,
          evidence: 'successful_status',
        })
      }

      const entities = states
        .filter(state => wanted.has(state.entity_id))
        .slice(0, 60)
        .map(state => ({
          entity_id: state.entity_id,
          name:
            typeof state.attributes?.friendly_name === 'string'
              ? state.attributes.friendly_name
              : state.entity_id,
          state: state.state,
          brightness: state.attributes?.brightness ?? null,
          temperature: state.attributes?.temperature ?? null,
          current_temperature: state.attributes?.current_temperature ?? null,
          humidity: state.attributes?.humidity ?? null,
          volume_level: state.attributes?.volume_level ?? null,
          media_title: state.attributes?.media_title ?? null,
        }))

      return JSON.stringify({
        ok: true,
        current_room: this.config.room || null,
        requested_area: args.area,
        requested_entity: args.entity,
        whole_home: args.whole_home,
        entities,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[Home Voice Agent] Home Assistant status failed', error)
      return JSON.stringify({ ok: false, error: message })
    }
  }

  private serviceForHomeAction(domain: HomeControlDomain, action: HomeControlAction): string {
    const allowed: Record<HomeControlDomain, Partial<Record<HomeControlAction, string>>> = {
      light: {
        turn_on: 'turn_on',
        turn_off: 'turn_off',
        toggle: 'toggle',
      },
      switch: {
        turn_on: 'turn_on',
        turn_off: 'turn_off',
        toggle: 'toggle',
      },
      fan: {
        turn_on: 'turn_on',
        turn_off: 'turn_off',
        toggle: 'toggle',
      },
      climate: {
        turn_on: 'turn_on',
        turn_off: 'turn_off',
        set_temperature: 'set_temperature',
      },
      media_player: {
        turn_on: 'turn_on',
        turn_off: 'turn_off',
        toggle: 'toggle',
        play: 'media_play',
        pause: 'media_pause',
        play_pause: 'media_play_pause',
        set_volume: 'volume_set',
        volume_up: 'volume_up',
        volume_down: 'volume_down',
        mute: 'volume_mute',
        unmute: 'volume_mute',
      },
    }

    const service = allowed[domain][action]

    if (!service) {
      throw new Error(`Action ${action} is not allowed for ${domain}.`)
    }

    return service
  }

  private async resolveHomeTargets(options: {
    domain?: string | undefined
    area: string | null
    entity: string | null
    wholeHome: boolean
  }): Promise<string[]> {
    await this.refreshHomeLearningMemory(false)

    let candidates = await this.getHomeCatalog()

    if (options.domain) {
      candidates = candidates.filter(entity => entity.domain === options.domain)
    }

    if (options.wholeHome) {
      if (!options.entity) {
        return candidates.map(entity => entity.entity_id)
      }

      return this.resolveNamedHomeEntity(options.entity, candidates)
    }

    const explicitArea = options.area

    if (explicitArea) {
      const areaId = await this.resolveHomeAreaId(explicitArea)
      const areaEntityIds = new Set(await this.getHomeAreaEntityIds(areaId))
      const areaCandidates = candidates.filter(entity => areaEntityIds.has(entity.entity_id))

      if (!options.entity) {
        return areaCandidates.map(entity => entity.entity_id)
      }

      return this.resolveNamedHomeEntity(options.entity, areaCandidates)
    }

    if (!options.entity) {
      if (!this.config.room) {
        throw new Error('The current tablet room is not configured.')
      }

      const areaId = await this.resolveHomeAreaId(this.config.room)
      const areaEntityIds = new Set(await this.getHomeAreaEntityIds(areaId))

      return candidates
        .filter(entity => areaEntityIds.has(entity.entity_id))
        .map(entity => entity.entity_id)
    }

    // A natural device name without an explicit area is resolved in the
    // current room first, then globally if there is no plausible local match.
    if (this.config.room) {
      try {
        const areaId = await this.resolveHomeAreaId(this.config.room)
        const areaEntityIds = new Set(await this.getHomeAreaEntityIds(areaId))
        const localCandidates = candidates.filter(entity => areaEntityIds.has(entity.entity_id))

        const local = this.tryResolveNamedHomeEntity(options.entity, localCandidates)

        if (local.length > 0) {
          return local
        }
      } catch (error) {
        console.warn('[Home Voice Agent] Local entity resolution failed; trying whole home', error)
      }
    }

    return this.resolveNamedHomeEntity(options.entity, candidates)
  }

  private resolveNamedHomeEntity(requestedName: string, candidates: HomeCatalogEntity[]): string[] {
    const resolved = this.tryResolveNamedHomeEntity(requestedName, candidates)

    if (resolved.length > 0) {
      return resolved
    }

    const candidateNames = candidates
      .slice(0, 20)
      .map(entity => `${entity.friendly_name} (${entity.entity_id})`)

    throw new Error(
      `No entity matching "${requestedName}" was found. Candidates: ${candidateNames.join(', ')}`,
    )
  }

  private tryResolveNamedHomeEntity(
    requestedName: string,
    candidates: HomeCatalogEntity[],
  ): string[] {
    const query = this.normalizeHomeName(requestedName)

    const learnedDirect = this.homeLearningStore.aliases
      .filter(
        alias =>
          alias.normalized_phrase === query &&
          alias.confidence >= HOME_LEARNING_DIRECT_CONFIDENCE &&
          candidates.some(entity => entity.entity_id === alias.entity_id),
      )
      .sort(
        (a, b) =>
          b.confidence - a.confidence ||
          b.successful_uses - a.successful_uses ||
          b.updated_at - a.updated_at,
      )

    if (
      learnedDirect.length > 0 &&
      learnedDirect[0] &&
      (!learnedDirect[1] ||
        learnedDirect[0].confidence - learnedDirect[1].confidence >= 0.08 ||
        learnedDirect[0].entity_id === learnedDirect[1].entity_id)
    ) {
      const winner = learnedDirect[0]
      winner.last_used_at = Date.now()
      winner.updated_at = Date.now()
      this.scheduleLearningSave()
      return [winner.entity_id]
    }

    const ranked = candidates
      .map(entity => ({ entity, score: this.scoreHomeEntity(query, entity) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)

    if (ranked.length === 0) {
      return []
    }

    const best = ranked[0]
    const second = ranked[1]

    if (best && best.score < 80) return []

    // Exact/very strong matches are safe to choose. For fuzzier matches we
    // require a useful lead over the runner-up so Dona does not guess between
    // two similar devices.
    if (best && (best.score >= 220 || !second || best.score - second.score >= 25)) {
      return [best.entity.entity_id]
    }

    const ambiguous = ranked
      .filter(item => (best?.score ?? 0) - item.score < 25)
      .slice(0, 8)
      .map(item => `${item.entity.friendly_name} (${item.entity.entity_id})`)

    throw new Error(
      `The device reference "${requestedName}" is ambiguous. Matches: ${ambiguous.join(', ')}`,
    )
  }

  private async getHomeAreas(): Promise<HomeAreaEntry[]> {
    if (!this.hass) {
      throw new Error('Home Assistant is not connected.')
    }

    const areas = await this.hass.callWS<HomeAreaEntry[]>({
      type: 'config/area_registry/list',
    })

    return Array.isArray(areas) ? areas : []
  }

  private async resolveHomeAreaId(areaName: string): Promise<string> {
    const areas = await this.getHomeAreas()
    const requested = this.normalizeHomeName(areaName)

    const exact = areas.filter(area => {
      const aliases = Array.isArray(area.aliases) ? area.aliases : []
      const candidates = [area.area_id, area.name, ...aliases]
        .map(value => this.normalizeHomeName(value))
        .filter(Boolean)

      return candidates.includes(requested)
    })

    if (exact.length === 1) return exact[0]?.area_id ?? ''

    const fuzzy = areas.filter(area => {
      const aliases = Array.isArray(area.aliases) ? area.aliases : []
      const candidates = [area.area_id, area.name, ...aliases]
        .map(value => this.normalizeHomeName(value))
        .filter(Boolean)

      return candidates.some(
        candidate => candidate.includes(requested) || requested.includes(candidate),
      )
    })

    if (fuzzy.length === 1) return fuzzy[0]?.area_id ?? ''
    if (fuzzy.length > 1) {
      throw new Error(
        `Area "${areaName}" is ambiguous. Matches: ${fuzzy.map(area => area.name).join(', ')}`,
      )
    }

    throw new Error(
      `Area "${areaName}" was not found. Available areas: ${areas.map(area => area.name).join(', ')}`,
    )
  }

  private async getHomeAreaEntityIds(areaId: string): Promise<string[]> {
    if (!this.hass) {
      throw new Error('Home Assistant is not connected.')
    }

    const result = await this.hass.callWS<HomeTargetExtraction>({
      type: 'extract_from_target',
      target: {
        area_id: [areaId],
      },
      expand_group: true,
    })

    return Array.isArray(result?.referenced_entities) ? result.referenced_entities : []
  }

  private async getHomeStates(): Promise<HassState[]> {
    if (!this.hass) {
      throw new Error('Home Assistant is not connected.')
    }

    const states = await this.hass.callWS<HassState[]>({
      type: 'get_states',
    })

    return Array.isArray(states) ? states : []
  }

  private normalizeHomeName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
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
      }
    }, 8_000)
  }

  private releaseSession(): void {
    const session = this.session
    const audioElement = this.audioElement
    const audioContext = this.audioContext

    if (this.homeLearningAgentUpdateTimer !== null) {
      window.clearTimeout(this.homeLearningAgentUpdateTimer)
      this.homeLearningAgentUpdateTimer = null
    }

    this.session = null
    this.activeAgentInstructions = null
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
    const highPass = audioContext.createBiquadFilter()
    const gain = audioContext.createGain()
    const compressor = audioContext.createDynamicsCompressor()

    // Preserve the clean voice we already have, but raise perceived loudness.
    // Remove sub-bass the tablet cannot reproduce, boost the useful speech
    // signal, then catch only the peaks *after* the boost so Android/WebView is
    // not fed an overdriven waveform.
    highPass.type = 'highpass'
    highPass.frequency.value = 80
    highPass.Q.value = 0.707

    // About +7.2 dB of amplitude gain (2.3x).
    gain.gain.value = 2.3

    // Near-limiter settings. Quiet and normal speech keeps the extra gain,
    // while only peaks near full scale are restrained.
    compressor.threshold.value = -3
    compressor.knee.value = 2
    compressor.ratio.value = 12
    compressor.attack.value = 0.002
    compressor.release.value = 0.12

    source.connect(highPass)
    highPass.connect(gain)
    gain.connect(compressor)
    compressor.connect(audioContext.destination)

    // We are rendering the remote MediaStream through Web Audio, so silence the
    // original element to avoid double playback / comb filtering.
    audioElement.muted = true
    audioElement.volume = 1

    await audioContext.resume()

    console.info('[Home Voice Agent] Clean audio output ready', {
      sampleRate: audioContext.sampleRate,
      gain: gain.gain.value,
      compressorThreshold: compressor.threshold.value,
      compressorRatio: compressor.ratio.value,
    })

    this.audioContext = audioContext
    this.audioSource = source
    this.audioGain = gain
    this.audioCompressor = compressor
  }
}
