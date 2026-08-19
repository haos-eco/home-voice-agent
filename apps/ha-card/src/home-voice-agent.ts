import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime'

import { HomeAssistantRealtimeWebRTC } from './home-assistant-realtime-webrtc'
import { WakeAudioPrebuffer } from './wake-audio-prebuffer'

export type VoiceAgentState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

export type VoiceAgentStartOptions = {
  inputReady?: boolean
  activationStartedAt?: number
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
}

type HomeLearningThresholds = {
  direct_alias_confidence: number
  preference_context_confidence: number
  alias_boost_confidence: number
}

type DurableMemoryScope = 'household' | 'user'
type DurableMemoryCategory = 'household_fact' | 'user_preference' | 'assistant_behavior'
type DurableMemorySource = 'explicit_user' | 'system'

type DurableMemory = {
  id: string
  scope: DurableMemoryScope
  user_id: string | null
  category: DurableMemoryCategory
  memory_key: string | null
  content: string
  normalized_content: string
  confidence: number
  source: DurableMemorySource
  priority: number
  created_at: number
  updated_at: number
  last_used_at: number | null
  use_count: number
}

type HomeLearningStore = {
  version: 2
  revision: number
  thresholds: HomeLearningThresholds
  aliases: LearnedEntityAlias[]
  preferences: LearnedNumericPreference[]
  memories: DurableMemory[]
  updated_at: number
}

type MemoryRememberArgs = {
  scope: DurableMemoryScope
  category: DurableMemoryCategory
  memory_key: string | null
  content: string
}

type MemoryRecallArgs = {
  query: string
  categories: DurableMemoryCategory[]
  limit: number
}

type MemoryForgetArgs = {
  memory_id: string
}

type HomeMemoryAliasObservationResponse = {
  ok?: boolean
  duplicate?: boolean
  event_id?: string
  revision?: number
  alias?: LearnedEntityAlias | null
}

type HomeMemoryPreferenceObservationResponse = {
  ok?: boolean
  duplicate?: boolean
  event_id?: string
  revision?: number
  preference?: LearnedNumericPreference | null
}

type HomeMemoryReconcileResponse = {
  ok?: boolean
  revision?: number
  entity_count?: number
  removed_aliases?: number
  removed_preferences?: number
}

type DurableMemoryRememberResponse = {
  ok?: boolean
  duplicate?: boolean
  event_id?: string
  revision?: number
  memory?: DurableMemory | null
}

type DurableMemoryRecallResponse = {
  ok?: boolean
  memories?: DurableMemory[]
}

type DurableMemoryForgetResponse = {
  ok?: boolean
  duplicate?: boolean
  event_id?: string
  revision?: number
  removed?: boolean
  memory_id?: string
}

type UserSpeechTranscript = {
  sequence: number
  itemId: string
  transcript: string
  normalized: string
  receivedAt: number
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
const HOME_AREAS_CACHE_MS = 5 * 60_000

const HOME_LEARNING_REFRESH_MS = 15_000
const HOME_LEARNING_DISCOVERY_HINT_MS = 60_000
const HOME_LEARNING_AGENT_UPDATE_DEBOUNCE_MS = 250
const HOME_SENSITIVE_TRANSCRIPT_WAIT_MS = 2_500

const DEFAULT_HOME_LEARNING_THRESHOLDS: HomeLearningThresholds = {
  direct_alias_confidence: 0.82,
  preference_context_confidence: 0.76,
  alias_boost_confidence: 0.48,
}

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

const MEMORY_REMEMBER_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: {
      type: 'string',
      enum: ['household', 'user'],
      description:
        'Use household for facts shared by the home. Use user for an individual preference or assistant behavior preference tied to the current Home Assistant user.',
    },
    category: {
      type: 'string',
      enum: ['household_fact', 'user_preference', 'assistant_behavior'],
      description:
        'household_fact is a durable fact about the home/household; user_preference is a durable individual preference; assistant_behavior controls how the assistant should respond or behave.',
    },
    memory_key: {
      type: ['string', 'null'],
      description:
        'A short stable semantic key when this memory may later be replaced, for example routine_response_style or battery_backup_goal. Use the same key when updating the same fact. Use null when no stable key is appropriate.',
    },
    content: {
      type: 'string',
      description:
        'A concise self-contained durable fact or preference. Store the meaning, not conversational filler.',
    },
  },
  required: ['scope', 'category', 'memory_key', 'content'],
} as const

const MEMORY_RECALL_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: {
      type: 'string',
      description:
        'Natural-language description of the durable fact or preference needed for the current request.',
    },
    categories: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['household_fact', 'user_preference', 'assistant_behavior'],
      },
      description:
        'Relevant categories, or an empty array to search all durable memory categories.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 12,
      description: 'Maximum number of memories to retrieve. Usually 4 to 8 is enough.',
    },
  },
  required: ['query', 'categories', 'limit'],
} as const

const MEMORY_FORGET_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    memory_id: {
      type: 'string',
      description:
        'Exact durable memory id to forget. Use a memory id already present in context or returned by memory_recall. Never guess an id.',
    },
  },
  required: ['memory_id'],
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

# Persistent Memory

You also have durable semantic memory for household facts, user preferences, and assistant-behavior preferences.
- Durable semantic memory is DIFFERENT from the automatic home alias/numeric learning above.
- Only call memory_remember when the user explicitly asks you to remember/store/note something for the future, or explicitly establishes a persistent future rule such as "da ora in poi", "sempre", or "non fare mai".
- Do NOT persist ordinary conversation, temporary plans, jokes, guesses, hypotheticals, or casual personal facts merely because they might be useful later. Those remain in the current Realtime conversation only.
- Do NOT infer durable personal facts from incidental speech.
- For sensitive personal, health, security, financial, or similarly private information, persist it only when the user explicitly asks you to remember that exact information.
- Use category household_fact for durable facts about the home/household that should be shared across endpoints.
- Use category user_preference for an individual user's durable preference.
- Use category assistant_behavior for persistent rules about how you should answer or behave; normally use user scope unless the user explicitly makes the rule household-wide.
- Prefer a short stable memory_key for facts/preferences likely to be updated later. Reuse the same key to replace the previous value rather than creating duplicates.
- Use memory_recall when a request may depend on a durable fact not already present in the compact persistent-memory context.
- If the user asks you to forget something and you do not already have its exact memory_id, use memory_recall first, then memory_forget with the exact returned id.
- Never invent a memory, memory id, or claim that something was remembered/forgotten unless the corresponding tool succeeds.
- Durable memory is contextual knowledge, not live Home Assistant state. Current Home Assistant state and the sensitive-action confirmation rules always take precedence.
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
  private inputMediaStream: MediaStream | null = null
  private wakeAudioPrebuffer: WakeAudioPrebuffer | null = null
  private startupTraceStartedAt = 0
  private startupTraceMarks = new Map<string, number>()
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
    revision: 0,
    thresholds: { ...DEFAULT_HOME_LEARNING_THRESHOLDS },
    aliases: [],
    preferences: [],
    memories: [],
    updated_at: 0,
  }
  private homeLearningLoaded = false
  private homeLearningLastRefresh = 0
  private homeLearningRefreshPromise: Promise<void> | null = null
  private homeLearningAgentUpdateTimer: number | null = null
  private learningEventCounter = 0
  private recentDiscoveryHints = new Map<string, RecentDiscoveryHint>()

  private homeAreasCache: HomeAreaEntry[] = []
  private homeAreasLastRefresh = 0
  private homeAreasRefreshPromise: Promise<HomeAreaEntry[]> | null = null

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
      void this.getHomeAreas().catch(error => {
        console.warn('[Home Voice Agent] Could not preload Home Assistant areas', error)
      })
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
    if (this.session || this.currentState === 'connecting') {
      return
    }

    const startupStartedAt = options.activationStartedAt ?? performance.now()
    this.beginStartupTrace(startupStartedAt)
    this.markStartupTrace('start_entered')

    this.lastError = null
    this.pendingSensitiveAction = null
    this.userSpeechSequence = 0
    this.userSpeechItemSequences.clear()
    this.userSpeechTranscripts.clear()

    this.clearErrorTimer()
    this.setState('connecting')

    try {
      if (!this.hass) {
        throw new Error('Home Assistant is not connected.')
      }

      const inputPreparation =
        !options.inputReady && this.prepareInputHook ? this.prepareInputHook() : Promise.resolve()

      const mediaPreparation = (async () => {
        await inputPreparation
        this.markStartupTrace('input_handoff_ready')
        this.markStartupTrace('get_user_media_started')

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

        this.inputMediaStream = stream
        this.markStartupTrace('get_user_media_ready')

        const prebuffer = new WakeAudioPrebuffer(stream, 24_000, 8_000, () => {
          this.markStartupTraceOnce('prebuffer_first_audio')
        })
        this.wakeAudioPrebuffer = prebuffer
        const prebufferEngine = await prebuffer.start()
        this.markStartupTrace('prebuffer_started')

        console.debug('[Home Voice Agent] Wake audio prebuffer ready', {
          engine: prebufferEngine,
        })

        const sourceTrack = stream.getAudioTracks()[0]
        if (!sourceTrack) {
          throw new Error('No microphone audio track is available.')
        }

        // Keep the original track feeding the local prebuffer. A disabled clone is
        // attached to WebRTC as soon as it exists, but it stays silent until the
        // buffered post-wake speech has been replayed over the Realtime data channel.
        const realtimeTrack = sourceTrack.clone()
        realtimeTrack.enabled = false

        this.markStartupTrace('media_pipeline_ready')
        return { stream, realtimeTrack }
      })()

      // These are deliberately background work. Neither memory refresh nor area
      // discovery is allowed to delay the Realtime handshake.
      const memoryPreparation = this.refreshHomeLearningMemory(false)
      const homeAreasPreparation = this.getHomeAreas().catch(error => {
        console.warn('[Home Voice Agent] Could not load Home Assistant areas', error)
        return [] as HomeAreaEntry[]
      })

      const audioElement = document.createElement('audio')
      audioElement.autoplay = true

      // The custom transport creates an audio transceiver immediately. It does not
      // wait for getUserMedia before creating/sending the SDP offer; when the real
      // microphone clone becomes available, replaceTrack() attaches it without a
      // second negotiation.
      const transport = new HomeAssistantRealtimeWebRTC({
        hass: this.hass,
        audioElement,
        audioTrackPromise: mediaPreparation.then(result => result.realtimeTrack),
        onTrace: stage => this.markStartupTrace(stage),
      })
      this.markStartupTrace('transport_created')

      const homeAreas = this.homeAreasCache
      const agentInstructions = this.buildAgentInstructions(homeAreas)
      const agent = new RealtimeAgent({
        name: 'Harvey',
        voice: 'cedar',
        instructions: agentInstructions,
        tools: this.createHomeAssistantTools(),
      })
      this.activeAgentInstructions = agentInstructions

      const session = new RealtimeSession(agent, {
        transport,
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
              voice: 'cedar',
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
          this.markStartupTrace('transport_connected')
          console.debug('[Home Voice Agent] Realtime connected', {
            activationMs: Math.round(performance.now() - startupStartedAt),
          })
          void this.setupBoostedAudio(audioElement)
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

      // Start SDP/WebRTC immediately. Microphone acquisition and prebuffer setup are
      // already running in parallel above, rather than blocking this call.
      this.markStartupTrace('session_connect_started')
      const connectionPreparation = session.connect({ apiKey: 'server-proxied' }).then(() => {
        this.markStartupTrace('session_connect_resolved')
      })

      const media = await mediaPreparation
      this.markStartupTrace('startup_prerequisites_ready')

      console.debug(
        '[Home Voice Agent] Startup prerequisites ready',
        JSON.stringify({
          elapsedMs: Math.round(performance.now() - startupStartedAt),
          memoryLoaded: this.homeLearningLoaded,
          memoryRevision: this.homeLearningStore.revision,
          cachedAreas: homeAreas.length,
          backgroundMemoryRefresh: !this.homeLearningLoaded,
          backgroundAreaRefresh: homeAreas.length === 0,
          transport: 'direct-sdp-via-home-assistant',
        }),
      )

      await connectionPreparation

      // Stop the local recorder first, replay all post-wake PCM into Realtime in
      // chronological order, then enable the live WebRTC track. This prevents live
      // RTP audio from overtaking the buffered beginning of the command.
      const prebuffer = this.wakeAudioPrebuffer
      this.markStartupTrace('prebuffer_flush_started')
      const buffered = prebuffer ? await prebuffer.stopAndTake() : null
      this.wakeAudioPrebuffer = null

      const bufferedAudio = buffered?.chunks ?? []
      let bufferedBytes = 0
      for (const chunk of bufferedAudio) {
        bufferedBytes += chunk.byteLength
        session.sendAudio(chunk)
      }
      this.markStartupTrace('prebuffer_flush_finished')

      media.realtimeTrack.enabled = true
      this.markStartupTrace('live_audio_enabled')
      this.setState('listening')
      this.resetInactivityTimer()

      console.debug(
        '[Home Voice Agent] Wake audio prebuffer flushed',
        JSON.stringify({
          engine: buffered?.captureEngine ?? 'none',
          chunks: bufferedAudio.length,
          bytes: bufferedBytes,
          originalAudioMs: buffered?.originalAudioMs ?? 0,
          audioMs: buffered?.audioMs ?? 0,
          trimmedLeadingMs: buffered?.trimmedLeadingMs ?? 0,
          firstSpeechOffsetMs: buffered?.firstSpeechOffsetMs ?? null,
          noiseFloorDb: buffered?.noiseFloorDb ?? null,
          speechThresholdDb: buffered?.speechThresholdDb ?? null,
        }),
      )

      void Promise.allSettled([memoryPreparation, homeAreasPreparation]).then(() => {
        if (this.session === session) {
          this.scheduleActiveAgentLearningRefresh()
        }
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

  public hardStop(): void {
    try {
      this.session?.interrupt()
    } catch (error) {
      console.warn('[Home Voice Agent] Could not interrupt Realtime before stop', error)
    }

    this.stop()
  }

  public interrupt(): void {
    this.session?.interrupt()
  }

  private handleRealtimeTransportEvent(event: unknown): void {
    if (!event || typeof event !== 'object' || !('type' in event)) return

    const payload = event as Record<string, unknown>
    const type = typeof payload.type === 'string' ? payload.type : ''

    if (type === 'response.created') {
      this.markStartupTraceOnce('first_response_created')
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      this.markStartupTraceOnce('first_speech_stopped')
    }

    if (type === 'response.function_call_arguments.done') {
      this.markStartupTraceOnce('first_tool_call_ready')
    }

    if (type === 'response.done') {
      this.markStartupTraceOnce('first_response_done')
    }

    if (type === 'output_audio_buffer.started') {
      this.markStartupTraceOnce('first_output_audio_started')
      this.logStartupTraceSummary()
    }

    if (type === 'input_audio_buffer.speech_started') {
      this.markStartupTraceOnce('first_speech_started')
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

      const normalized = this.normalizeConfirmationSpeech(transcript)

      this.userSpeechTranscripts.set(sequence, {
        sequence,
        itemId: payload.item_id,
        transcript,
        normalized,
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
        alias => alias.confidence >= this.homeLearningDirectConfidence,
      ).length,
      learnedPreferences: this.homeLearningStore.preferences.length,
      durableMemories: this.homeLearningStore.memories.length,
      learningStoreVersion: this.homeLearningStore.version,
      learningRevision: this.homeLearningStore.revision,
      learningStorage: 'backend_sqlite',
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
      .filter(alias => alias.confidence >= this.homeLearningDirectConfidence)
      .sort((a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at)
      .slice(0, 20)
      .map(alias => {
        const area = alias.area_name ? ` in ${alias.area_name}` : ''
        return `- "${alias.phrase}"${area} -> ${alias.entity_id}`
      })

    const preferences = this.homeLearningStore.preferences
      .filter(preference => preference.confidence >= this.homeLearningPreferenceContextConfidence)
      .sort((a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at)
      .slice(0, 12)
      .map(preference => {
        const area = preference.area_name ? ` in ${preference.area_name}` : ''
        return `- ${preference.metric}${area} for ${preference.entity_id}: ${Number(preference.value.toFixed(3))}`
      })

    const memories = this.homeLearningStore.memories
      .slice()
      .sort((a, b) => b.priority - a.priority || b.updated_at - a.updated_at)
      .slice(0, 12)
      .map(memory => {
        const key = memory.memory_key ? ` key=${memory.memory_key}` : ''
        return `- [${memory.id}] (${memory.category}/${memory.scope}${key}) ${memory.content}`
      })

    if (aliases.length === 0 && preferences.length === 0 && memories.length === 0) {
      return '- No persistent household/user memory is available yet.'
    }

    return `# Persistent context

This compact context is loaded from the backend SQLite memory store. Treat it as durable context, not live Home Assistant state.

${
  memories.length > 0
    ? `Durable semantic memories:
${memories.join('\n')}`
    : 'Durable semantic memories: none yet.'
}

${
  aliases.length > 0
    ? `Learned home aliases:
${aliases.join('\n')}`
    : 'Learned home aliases: none yet.'
}

${
  preferences.length > 0
    ? `Learned numeric home preferences:
${preferences.join('\n')}`
    : 'Learned numeric home preferences: none yet.'
}`
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
      name: 'Harvey',
      voice: 'cedar',
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

    const memoryRemember = tool({
      name: 'memory_remember',
      description:
        'Persist a durable semantic memory only when the user explicitly asks to remember/store something for the future or explicitly establishes a persistent future rule. Do not use for ordinary conversation. Home Assistant aliases and numeric device preferences belong in home_learning_observe instead.',
      parameters: MEMORY_REMEMBER_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeMemoryRemember(input as MemoryRememberArgs),
    })

    const memoryRecall = tool({
      name: 'memory_recall',
      description:
        'Retrieve relevant durable household facts, user preferences, or assistant-behavior preferences when the compact startup context may not contain what the current request needs.',
      parameters: MEMORY_RECALL_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeMemoryRecall(input as MemoryRecallArgs),
    })

    const memoryForget = tool({
      name: 'memory_forget',
      description:
        "Forget one exact durable memory at the user's explicit request. The memory_id must come from persistent context or memory_recall; never guess it.",
      parameters: MEMORY_FORGET_PARAMETERS as any,
      strict: true,
      execute: async input => this.executeMemoryForget(input as MemoryForgetArgs),
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

    return [
      findEntities,
      control,
      learningObserve,
      memoryRemember,
      memoryRecall,
      memoryForget,
      sensitiveControl,
      status,
      listAreas,
    ]
  }

  private async executeMemoryRemember(args: MemoryRememberArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    const content = args.content?.trim()
    if (!content || content.length < 3) {
      return JSON.stringify({ ok: false, error: 'Durable memory content is required.' })
    }

    try {
      const response = await this.hass.callWS<DurableMemoryRememberResponse>({
        type: 'home_voice_agent/memory_remember',
        scope: args.scope,
        category: args.category,
        memory_key: args.memory_key?.trim() || null,
        content,
        event_id: this.createLearningEventId('memory-remember'),
        source_device: this.config.deviceId || null,
        at: Date.now(),
      })

      const memory = this.sanitizeDurableMemory(response?.memory)
      if (!response?.ok || !memory) {
        return JSON.stringify({ ok: false, error: 'Could not persist durable memory.' })
      }

      this.upsertDurableMemory(memory)
      if (typeof response.revision === 'number' && Number.isFinite(response.revision)) {
        this.homeLearningStore.revision = Math.max(
          this.homeLearningStore.revision,
          Math.trunc(response.revision),
        )
      }
      this.homeLearningLoaded = true
      this.homeLearningLastRefresh = Date.now()
      this.scheduleActiveAgentLearningRefresh()
      void this.refreshHomeLearningMemory(true)

      return JSON.stringify({
        ok: true,
        remembered: {
          id: memory.id,
          scope: memory.scope,
          category: memory.category,
          memory_key: memory.memory_key,
          content: memory.content,
        },
      })
    } catch (error) {
      console.warn('[Home Voice Agent] Could not persist durable memory', error)
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async executeMemoryRecall(args: MemoryRecallArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    try {
      const response = await this.hass.callWS<DurableMemoryRecallResponse>({
        type: 'home_voice_agent/memory_recall',
        query: args.query?.trim() || '',
        categories: Array.isArray(args.categories) ? args.categories : [],
        limit: Math.max(1, Math.min(12, Math.trunc(args.limit || 6))),
      })
      const memories = Array.isArray(response?.memories)
        ? response.memories
            .map(value => this.sanitizeDurableMemory(value))
            .filter((value): value is DurableMemory => value !== null)
        : []

      return JSON.stringify({
        ok: true,
        memories: memories.map(memory => ({
          id: memory.id,
          scope: memory.scope,
          category: memory.category,
          memory_key: memory.memory_key,
          content: memory.content,
          updated_at: memory.updated_at,
        })),
      })
    } catch (error) {
      console.warn('[Home Voice Agent] Could not recall durable memory', error)
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async executeMemoryForget(args: MemoryForgetArgs): Promise<string> {
    if (!this.hass) {
      return JSON.stringify({ ok: false, error: 'Home Assistant is not connected.' })
    }

    const memoryId = args.memory_id?.trim()
    if (!memoryId) {
      return JSON.stringify({ ok: false, error: 'memory_id is required.' })
    }

    try {
      const response = await this.hass.callWS<DurableMemoryForgetResponse>({
        type: 'home_voice_agent/memory_forget',
        memory_id: memoryId,
        event_id: this.createLearningEventId('memory-forget'),
        source_device: this.config.deviceId || null,
        at: Date.now(),
      })

      if (!response?.ok) {
        return JSON.stringify({ ok: false, error: 'Could not forget durable memory.' })
      }

      if (response.removed) {
        this.homeLearningStore.memories = this.homeLearningStore.memories.filter(
          memory => memory.id !== memoryId,
        )
        if (typeof response.revision === 'number' && Number.isFinite(response.revision)) {
          this.homeLearningStore.revision = Math.max(
            this.homeLearningStore.revision,
            Math.trunc(response.revision),
          )
        }
        this.homeLearningLastRefresh = Date.now()
        this.scheduleActiveAgentLearningRefresh()
        void this.refreshHomeLearningMemory(true)
      }

      return JSON.stringify({
        ok: true,
        removed: Boolean(response.removed),
        memory_id: memoryId,
      })
    } catch (error) {
      console.warn('[Home Voice Agent] Could not forget durable memory', error)
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
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

        const stored = await this.observeLearnedAlias({
          phrase: args.phrase,
          areaName: args.area || target?.area_name || areaName,
          domain: args.domain || target?.domain || null,
          entityId: entity,
          evidence: args.correction ? 'explicit_correction' : 'explicit_learning',
        })

        if (!stored) {
          return JSON.stringify({
            ok: false,
            error: 'Could not persist the learned alias.',
          })
        }

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

      const stored = await this.observeNumericPreference({
        metric: args.metric,
        value: sanitizedPreferenceValue,
        areaName: args.area || target?.area_name || areaName,
        entityId: entity,
        evidence: args.correction ? 'correction' : 'explicit',
      })

      if (!stored) {
        return JSON.stringify({
          ok: false,
          error: 'Could not persist the numeric preference.',
        })
      }

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
        alias.confidence < this.homeLearningAliasBoostConfidence
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
        alias.confidence >= this.homeLearningDirectConfidence
          ? 250 * alias.confidence
          : 130 * alias.confidence

      bestBoost = Math.max(bestBoost, Math.round(boost))
    }

    return bestBoost
  }

  private emptyLearningStore(): HomeLearningStore {
    return {
      version: 2,
      revision: 0,
      thresholds: { ...DEFAULT_HOME_LEARNING_THRESHOLDS },
      aliases: [],
      preferences: [],
      memories: [],
      updated_at: 0,
    }
  }

  private get homeLearningDirectConfidence(): number {
    return this.homeLearningStore.thresholds.direct_alias_confidence
  }

  private get homeLearningPreferenceContextConfidence(): number {
    return this.homeLearningStore.thresholds.preference_context_confidence
  }

  private get homeLearningAliasBoostConfidence(): number {
    return this.homeLearningStore.thresholds.alias_boost_confidence
  }

  private safeFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }

  private safeNonNegativeInteger(value: unknown, fallback = 0): number {
    return Math.max(0, Math.trunc(this.safeFiniteNumber(value, fallback)))
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

    return value >= 5 && value <= 40 ? value : null
  }

  private createLearningEventId(prefix: string): string {
    this.learningEventCounter = (this.learningEventCounter + 1) % Number.MAX_SAFE_INTEGER

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}:${crypto.randomUUID()}`
    }

    return `${prefix}:${Date.now().toString(36)}:${this.learningEventCounter.toString(36)}:${Math.random()
      .toString(36)
      .slice(2)}`
  }

  private sanitizeLearnedAlias(value: unknown): LearnedEntityAlias | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const item = value as Record<string, unknown>

    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const phrase = typeof item.phrase === 'string' ? item.phrase.trim() : ''
    const entityId = typeof item.entity_id === 'string' ? item.entity_id.trim() : ''
    if (!id || !phrase || !entityId) return null

    const normalizedPhrase =
      typeof item.normalized_phrase === 'string' && item.normalized_phrase.trim()
        ? item.normalized_phrase.trim()
        : this.normalizeHomeName(phrase)
    const createdAt = this.safeTimestamp(item.created_at, Date.now())
    const updatedAt = this.safeTimestamp(item.updated_at, createdAt)

    return {
      id,
      phrase,
      normalized_phrase: normalizedPhrase,
      area_name: this.safeNullableString(item.area_name),
      domain: this.safeNullableString(item.domain),
      entity_id: entityId,
      confidence: Math.max(0, Math.min(0.99, this.safeFiniteNumber(item.confidence, 0))),
      observations: this.safeNonNegativeInteger(item.observations),
      successful_uses: this.safeNonNegativeInteger(item.successful_uses),
      contradictions: this.safeNonNegativeInteger(item.contradictions),
      created_at: createdAt,
      updated_at: updatedAt,
      last_used_at:
        item.last_used_at === null || item.last_used_at === undefined
          ? null
          : this.safeTimestamp(item.last_used_at, updatedAt),
    }
  }

  private sanitizeLearnedPreference(value: unknown): LearnedNumericPreference | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const item = value as Record<string, unknown>
    if (!this.isLearningMetric(item.metric)) return null

    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const entityId = typeof item.entity_id === 'string' ? item.entity_id.trim() : ''
    const numericValue = this.sanitizePreferenceValue(item.metric, item.value)
    if (!id || !entityId || numericValue === null) return null

    const createdAt = this.safeTimestamp(item.created_at, Date.now())
    const updatedAt = this.safeTimestamp(item.updated_at, createdAt)

    return {
      id,
      metric: item.metric,
      area_name: this.safeNullableString(item.area_name),
      entity_id: entityId,
      value: numericValue,
      confidence: Math.max(0, Math.min(0.99, this.safeFiniteNumber(item.confidence, 0))),
      observations: this.safeNonNegativeInteger(item.observations),
      created_at: createdAt,
      updated_at: updatedAt,
      last_used_at:
        item.last_used_at === null || item.last_used_at === undefined
          ? null
          : this.safeTimestamp(item.last_used_at, updatedAt),
    }
  }

  private sanitizeDurableMemory(value: unknown): DurableMemory | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const item = value as Record<string, unknown>

    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const content = typeof item.content === 'string' ? item.content.trim() : ''
    const scope = item.scope
    const category = item.category
    const source = item.source
    if (
      !id ||
      !content ||
      (scope !== 'household' && scope !== 'user') ||
      (category !== 'household_fact' &&
        category !== 'user_preference' &&
        category !== 'assistant_behavior') ||
      (source !== 'explicit_user' && source !== 'system')
    ) {
      return null
    }

    const createdAt = this.safeTimestamp(item.created_at, Date.now())
    const updatedAt = this.safeTimestamp(item.updated_at, createdAt)
    const userId = this.safeNullableString(item.user_id)
    if (scope === 'user' && !userId) return null

    return {
      id,
      scope,
      user_id: scope === 'user' ? userId : null,
      category,
      memory_key: this.safeNullableString(item.memory_key),
      content,
      normalized_content:
        typeof item.normalized_content === 'string' && item.normalized_content.trim()
          ? item.normalized_content.trim()
          : this.normalizeHomeName(content),
      confidence: Math.max(0, Math.min(0.99, this.safeFiniteNumber(item.confidence, 0.99))),
      source,
      priority: Math.max(0, Math.min(1, this.safeFiniteNumber(item.priority, 0.75))),
      created_at: createdAt,
      updated_at: updatedAt,
      last_used_at:
        item.last_used_at === null || item.last_used_at === undefined
          ? null
          : this.safeTimestamp(item.last_used_at, updatedAt),
      use_count: this.safeNonNegativeInteger(item.use_count),
    }
  }

  private sanitizeLearningContext(value: unknown): HomeLearningStore {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return this.emptyLearningStore()
    }

    const candidate = value as Record<string, unknown>
    const rawThresholds =
      candidate.thresholds && typeof candidate.thresholds === 'object'
        ? (candidate.thresholds as Record<string, unknown>)
        : {}

    const aliases = Array.isArray(candidate.aliases)
      ? candidate.aliases
          .map(value => this.sanitizeLearnedAlias(value))
          .filter((value): value is LearnedEntityAlias => value !== null)
      : []
    const preferences = Array.isArray(candidate.preferences)
      ? candidate.preferences
          .map(value => this.sanitizeLearnedPreference(value))
          .filter((value): value is LearnedNumericPreference => value !== null)
      : []
    const memories = Array.isArray(candidate.memories)
      ? candidate.memories
          .map(value => this.sanitizeDurableMemory(value))
          .filter((value): value is DurableMemory => value !== null)
      : []

    return {
      version: 2,
      revision: this.safeNonNegativeInteger(candidate.revision),
      thresholds: {
        direct_alias_confidence: Math.max(
          0,
          Math.min(
            0.99,
            this.safeFiniteNumber(
              rawThresholds.direct_alias_confidence,
              DEFAULT_HOME_LEARNING_THRESHOLDS.direct_alias_confidence,
            ),
          ),
        ),
        preference_context_confidence: Math.max(
          0,
          Math.min(
            0.99,
            this.safeFiniteNumber(
              rawThresholds.preference_context_confidence,
              DEFAULT_HOME_LEARNING_THRESHOLDS.preference_context_confidence,
            ),
          ),
        ),
        alias_boost_confidence: Math.max(
          0,
          Math.min(
            0.99,
            this.safeFiniteNumber(
              rawThresholds.alias_boost_confidence,
              DEFAULT_HOME_LEARNING_THRESHOLDS.alias_boost_confidence,
            ),
          ),
        ),
      },
      aliases,
      preferences,
      memories,
      updated_at: this.safeNonNegativeInteger(candidate.updated_at),
    }
  }

  private learningContextSignature(store = this.homeLearningStore): string {
    const aliases = store.aliases
      .map(alias => `${alias.id}:${alias.confidence}:${alias.updated_at}`)
      .sort()
      .join('|')
    const preferences = store.preferences
      .map(
        preference =>
          `${preference.id}:${preference.value}:${preference.confidence}:${preference.updated_at}`,
      )
      .sort()
      .join('|')
    const memories = store.memories
      .map(memory => `${memory.id}:${memory.updated_at}:${memory.content}`)
      .sort()
      .join('|')

    return `${store.revision}::${aliases}::${preferences}::${memories}`
  }

  private upsertLearnedAlias(alias: LearnedEntityAlias): void {
    const index = this.homeLearningStore.aliases.findIndex(item => item.id === alias.id)
    if (index >= 0) this.homeLearningStore.aliases[index] = alias
    else this.homeLearningStore.aliases.push(alias)

    this.homeLearningStore.updated_at = Math.max(
      this.homeLearningStore.updated_at,
      alias.updated_at,
    )
  }

  private upsertLearnedPreference(preference: LearnedNumericPreference): void {
    const index = this.homeLearningStore.preferences.findIndex(item => item.id === preference.id)
    if (index >= 0) this.homeLearningStore.preferences[index] = preference
    else this.homeLearningStore.preferences.push(preference)

    this.homeLearningStore.updated_at = Math.max(
      this.homeLearningStore.updated_at,
      preference.updated_at,
    )
  }

  private upsertDurableMemory(memory: DurableMemory): void {
    const index = this.homeLearningStore.memories.findIndex(item => item.id === memory.id)
    if (index >= 0) this.homeLearningStore.memories[index] = memory
    else this.homeLearningStore.memories.push(memory)

    this.homeLearningStore.updated_at = Math.max(
      this.homeLearningStore.updated_at,
      memory.updated_at,
    )
  }

  private async refreshHomeLearningMemory(force: boolean): Promise<void> {
    if (!this.hass) return

    const fresh =
      this.homeLearningLoaded &&
      Date.now() - this.homeLearningLastRefresh < HOME_LEARNING_REFRESH_MS

    if (!force && fresh) return

    // Once a cache exists, stale reads never hold up wake-word activation or a
    // tool call. Refresh the backend snapshot in the background and update an
    // active Realtime session when it arrives.
    if (!force && this.homeLearningLoaded) {
      void this.refreshHomeLearningMemory(true)
      return
    }

    if (this.homeLearningRefreshPromise) {
      await this.homeLearningRefreshPromise
      return
    }

    this.homeLearningRefreshPromise = (async () => {
      const beforeSignature = this.learningContextSignature()
      const payload = await this.hass!.callWS<unknown>({
        type: 'home_voice_agent/memory_context',
      })
      const context = this.sanitizeLearningContext(payload)

      this.homeLearningStore = context
      this.homeLearningLoaded = true
      this.homeLearningLastRefresh = Date.now()

      if (this.learningContextSignature(context) !== beforeSignature) {
        this.scheduleActiveAgentLearningRefresh()
      }
    })()

    try {
      await this.homeLearningRefreshPromise
    } catch (error) {
      console.warn('[Home Voice Agent] Could not refresh backend learning memory', error)
    } finally {
      this.homeLearningRefreshPromise = null
    }
  }

  private async observeLearnedAlias(options: {
    phrase: string
    areaName: string | null
    domain: string | null
    entityId: string
    evidence: LearnedAliasEvidenceKind
  }): Promise<boolean> {
    if (!this.hass) return false

    const phrase = options.phrase.trim()
    const normalized = this.normalizeHomeName(phrase)
    if (!normalized || normalized.length < 2 || !options.entityId.trim()) return false

    try {
      const now = Date.now()
      const response = await this.hass.callWS<HomeMemoryAliasObservationResponse>({
        type: 'home_voice_agent/memory_alias_observe',
        phrase,
        area_name: options.areaName?.trim() || null,
        domain: options.domain?.trim() || null,
        entity_id: options.entityId.trim(),
        evidence: options.evidence,
        event_id: this.createLearningEventId(`alias-${options.evidence}`),
        source_device: this.config.deviceId || null,
        at: now,
      })

      const alias = this.sanitizeLearnedAlias(response?.alias)
      if (alias) this.upsertLearnedAlias(alias)
      if (typeof response?.revision === 'number' && Number.isFinite(response.revision)) {
        this.homeLearningStore.revision = Math.max(
          this.homeLearningStore.revision,
          Math.trunc(response.revision),
        )
      }

      this.homeLearningLoaded = true
      this.homeLearningLastRefresh = Date.now()
      this.scheduleActiveAgentLearningRefresh()

      if (
        options.evidence === 'successful_action' ||
        options.evidence === 'explicit_learning' ||
        options.evidence === 'explicit_correction'
      ) {
        // Strong alias evidence can also reduce confidence on competing mappings
        // server-side. Pull the full authoritative snapshot in the background.
        void this.refreshHomeLearningMemory(true)
      }

      return true
    } catch (error) {
      console.warn('[Home Voice Agent] Could not persist learned alias', error)
      return false
    }
  }

  private async observeNumericPreference(options: {
    metric: LearnedNumericPreference['metric']
    value: number
    areaName: string | null
    entityId: string
    evidence?: 'implicit' | 'explicit' | 'correction'
  }): Promise<boolean> {
    if (!this.hass) return false

    const value = this.sanitizePreferenceValue(options.metric, options.value)
    if (value === null || !options.entityId.trim()) return false

    const evidence = options.evidence ?? 'implicit'

    try {
      const now = Date.now()
      const response = await this.hass.callWS<HomeMemoryPreferenceObservationResponse>({
        type: 'home_voice_agent/memory_preference_observe',
        metric: options.metric,
        area_name: options.areaName?.trim() || null,
        entity_id: options.entityId.trim(),
        value,
        evidence,
        event_id: this.createLearningEventId(`preference-${evidence}`),
        source_device: this.config.deviceId || null,
        at: now,
      })

      const preference = this.sanitizeLearnedPreference(response?.preference)
      if (preference) this.upsertLearnedPreference(preference)
      if (typeof response?.revision === 'number' && Number.isFinite(response.revision)) {
        this.homeLearningStore.revision = Math.max(
          this.homeLearningStore.revision,
          Math.trunc(response.revision),
        )
      }

      this.homeLearningLoaded = true
      this.homeLearningLastRefresh = Date.now()
      this.scheduleActiveAgentLearningRefresh()
      return true
    } catch (error) {
      console.warn('[Home Voice Agent] Could not persist numeric preference', error)
      return false
    }
  }

  private async reconcileLearningMemoryWithCatalog(catalog: HomeCatalogEntity[]): Promise<void> {
    if (!this.hass || catalog.length === 0) return

    try {
      const result = await this.hass.callWS<HomeMemoryReconcileResponse>({
        type: 'home_voice_agent/memory_catalog_reconcile',
        entity_ids: catalog.map(entity => entity.entity_id),
        at: Date.now(),
      })

      const removedAliases = this.safeNonNegativeInteger(result?.removed_aliases)
      const removedPreferences = this.safeNonNegativeInteger(result?.removed_preferences)

      if (removedAliases > 0 || removedPreferences > 0) {
        await this.refreshHomeLearningMemory(true)
        console.info('[Home Voice Agent] Backend removed persistently stale learned references', {
          aliases: removedAliases,
          preferences: removedPreferences,
        })
      }
    } catch (error) {
      console.warn('[Home Voice Agent] Could not reconcile backend learning memory', error)
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

        void this.reconcileLearningMemoryWithCatalog(catalog)

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
      subscribe('area_registry_updated', () => {
        this.homeAreasLastRefresh = 0
        this.scheduleHomeKnowledgeRefresh('area registry changed')
      }),
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
          alias.confidence >= this.homeLearningDirectConfidence &&
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
    // require a useful lead over the runner-up so Harvey does not guess between
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

  private async getHomeAreas(force = false): Promise<HomeAreaEntry[]> {
    if (!this.hass) {
      throw new Error('Home Assistant is not connected.')
    }

    if (
      !force &&
      this.homeAreasLastRefresh > 0 &&
      Date.now() - this.homeAreasLastRefresh < HOME_AREAS_CACHE_MS
    ) {
      return this.homeAreasCache
    }

    if (this.homeAreasRefreshPromise) {
      return this.homeAreasRefreshPromise
    }

    this.homeAreasRefreshPromise = (async () => {
      const areas = await this.hass!.callWS<HomeAreaEntry[]>({
        type: 'config/area_registry/list',
      })
      this.homeAreasCache = Array.isArray(areas) ? areas : []
      this.homeAreasLastRefresh = Date.now()
      return this.homeAreasCache
    })()

    try {
      return await this.homeAreasRefreshPromise
    } finally {
      this.homeAreasRefreshPromise = null
    }
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

  private beginStartupTrace(startedAt: number): void {
    this.startupTraceStartedAt = startedAt
    this.startupTraceMarks.clear()
    this.startupTraceMarks.set('activation', 0)
  }

  private markStartupTrace(stage: string): void {
    if (this.startupTraceStartedAt <= 0) return

    const elapsedMs = performance.now() - this.startupTraceStartedAt
    this.startupTraceMarks.set(stage, elapsedMs)

    console.debug('[Home Voice Agent] Startup trace', {
      stage,
      elapsedMs: Math.round(elapsedMs),
    })
  }

  private markStartupTraceOnce(stage: string): void {
    if (this.startupTraceMarks.has(stage)) return
    this.markStartupTrace(stage)
  }

  private logStartupTraceSummary(): void {
    if (this.startupTraceStartedAt <= 0) return

    const timings = Object.fromEntries(
      [...this.startupTraceMarks.entries()].map(([stage, elapsedMs]) => [
        stage,
        Math.round(elapsedMs),
      ]),
    )

    console.info('[Home Voice Agent] Startup timing summary', JSON.stringify(timings))
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
    const inputMediaStream = this.inputMediaStream
    const wakeAudioPrebuffer = this.wakeAudioPrebuffer
    const audioContext = this.audioContext

    if (this.homeLearningAgentUpdateTimer !== null) {
      window.clearTimeout(this.homeLearningAgentUpdateTimer)
      this.homeLearningAgentUpdateTimer = null
    }

    this.session = null
    this.activeAgentInstructions = null
    this.audioElement = null
    this.inputMediaStream = null
    this.wakeAudioPrebuffer = null

    this.audioContext = null
    this.audioSource = null
    this.audioGain = null
    this.audioCompressor = null

    if (wakeAudioPrebuffer) {
      void wakeAudioPrebuffer.discard().catch(error => {
        console.warn('[Home Voice Agent] Error discarding wake audio prebuffer', error)
      })
    }

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

    if (inputMediaStream) {
      for (const track of inputMediaStream.getTracks()) {
        track.stop()
      }
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
