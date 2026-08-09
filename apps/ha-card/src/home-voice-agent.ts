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

const HOME_KNOWLEDGE_REFRESH_MS = 60_000
const HOME_KNOWLEDGE_DEBOUNCE_MS = 750

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
- Locks, alarms, gates, garage doors, security devices, and other sensitive physical-access actions are not available through the current tools. Do not claim to control them.

When a command is clear, act immediately and answer with a short natural confirmation.

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
  private hassInitiallyBound = false
  private stopping = false
  private prepareInputHook: PrepareInputHook | null = null
  private pendingSensitiveAction: PendingSensitiveAction | null = null
  private userSpeechSequence = 0

  private homeCatalogCache: HomeCatalogEntity[] = []
  private homeKnowledgeLastRefresh = 0
  private homeKnowledgeVersion = 0
  private homeKnowledgeRefreshPromise: Promise<void> | null = null
  private homeKnowledgeRefreshTimer: number | null = null
  private homeKnowledgeDebounceTimer: number | null = null
  private homeKnowledgeConnection: HassConnectionLike | null = null
  private homeKnowledgeUnsubscribers: Array<() => Promise<void>> = []

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
    }
  }

  public bindHass(hass: HassLike): void {
    this.hass = hass

    if (!this.hassInitiallyBound) {
      this.hassInitiallyBound = true
      void this.publishState()
      void this.refreshHomeKnowledge('initial bind')
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

      const homeAreas = await this.getHomeAreas().catch(error => {
        console.warn('[Home Voice Agent] Could not load Home Assistant areas', error)
        return [] as HomeAreaEntry[]
      })

      const agent = new RealtimeAgent({
        name: 'Dona',
        voice: 'marin',
        instructions: this.buildAgentInstructions(homeAreas),
        tools: this.createHomeAssistantTools(),
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
          this.userSpeechSequence += 1
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
      homeDiscovery: 'live Home Assistant knowledge graph',
      homeKnowledgeEntities: this.homeCatalogCache.length,
      homeKnowledgeVersion: this.homeKnowledgeVersion,
      homeKnowledgeLastRefresh: this.homeKnowledgeLastRefresh || null,
      homeKnowledgeSubscriptions: this.homeKnowledgeUnsubscribers.length,
      sensitiveActionPending: Boolean(this.pendingSensitiveAction),
    }
  }

  private buildAgentInstructions(areas: HomeAreaEntry[]): string {
    const areaNames = areas.map(area => area.name).filter(Boolean)
    const room = this.config.room || 'unknown'

    return `${AGENT_INSTRUCTIONS}

# Current endpoint context

- This voice endpoint/tablet is configured for room: ${room}.
- Home Assistant areas currently available: ${areaNames.length > 0 ? areaNames.join(', ') : 'not available'}.
- The live Home Assistant knowledge layer currently knows ${this.homeCatalogCache.length} entities and is refreshed automatically when Home Assistant changes.
- Remember: the current endpoint room is only a fallback. Any room explicitly named by the user takes priority.`
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

    return [findEntities, control, sensitiveControl, status, listAreas]
  }

  private async executeHomeFindEntities(args: HomeFindEntitiesArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    try {
      const limit = Math.max(1, Math.min(12, Math.trunc(args.limit || 5)))
      const result = await this.findHomeEntities({
        query: args.query,
        area: args.area,
        domain: args.domain,
        wholeHome: args.whole_home,
        limit,
      })

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

    return best
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

        await this.hass.callWS({
          type: 'call_service',
          domain: pending.domain,
          service: pending.service,
          service_data: {},
          target: {
            entity_id: pending.entityIds,
          },
        })

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

    if (second && best && best.score < 220 && best.score - second.score < 25) {
      const matches = ranked
        .slice(0, 6)
        .map(item => `${item.entity.friendly_name} (${item.entity.entity_id})`)

      throw new Error(
        `The sensitive target "${query}" is ambiguous. Matches: ${matches.join(', ')}`,
      )
    }

    return best?.entity!
  }

  private isSensitiveHomeEntity(entity: HomeCatalogEntity): boolean {
    if (entity.domain === 'lock' || entity.domain === 'alarm_control_panel') {
      return true
    }

    if (
      entity.domain === 'cover' &&
      ['door', 'garage', 'gate'].includes(this.normalizeHomeName(entity.device_class ?? ''))
    ) {
      return true
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

    const name = this.normalizeHomeName(
      [
        entity.entity_id,
        entity.friendly_name,
        ...entity.aliases,
        entity.device_name ?? '',
        entity.device_model ?? '',
      ].join(' '),
    )

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

    return keywords.some(keyword => name.includes(this.normalizeHomeName(keyword)))
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

      if (sensitiveTargets.length > 0) {
        return JSON.stringify({
          ok: false,
          sensitive: true,
          error:
            'This target is classified as sensitive. Use home_sensitive_control so a separate explicit confirmation is required.',
          targets: sensitiveTargets.map(entity => ({
            entity_id: entity.entity_id,
            name: entity.friendly_name,
            domain: entity.domain,
          })),
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
      const wanted = new Set(entityIds)

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
    const catalog = await this.getHomeCatalog()
    let candidates = catalog

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

    // About +10.1 dB. This is deliberately a moderate step up from 2.3x.
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
