import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type AliasEvidenceKind =
  | 'discovery'
  | 'successful_status'
  | 'successful_action'
  | 'explicit_learning'
  | 'explicit_correction'

export type PreferenceMetric = 'temperature' | 'volume_level' | 'brightness_pct'
export type PreferenceEvidenceKind = 'implicit' | 'explicit' | 'correction'

export type MemoryThresholds = {
  directAliasConfidence: number
  preferenceContextConfidence: number
  aliasBoostConfidence: number
  staleRefreshLimit: number
  minRetainedConfidence: number
  maxAliases: number
  maxPreferences: number
  maxEvents: number
}

export type AliasRow = {
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
  stale_misses: number
  deleted_at: number | null
}

export type PreferenceRow = {
  id: string
  metric: PreferenceMetric
  area_name: string | null
  entity_id: string
  value: number
  confidence: number
  observations: number
  created_at: number
  updated_at: number
  last_used_at: number | null
  stale_misses: number
  deleted_at: number | null
}

export type AliasObservation = {
  event_id?: string
  phrase: string
  area_name: string | null
  domain: string | null
  entity_id: string
  evidence: AliasEvidenceKind
  source_device?: string | null
  at?: number
}

export type PreferenceObservation = {
  event_id?: string
  metric: PreferenceMetric
  area_name: string | null
  entity_id: string
  value: number
  evidence?: PreferenceEvidenceKind
  source_device?: string | null
  at?: number
}

export type MemoryContext = {
  version: 1
  revision: number
  thresholds: {
    direct_alias_confidence: number
    preference_context_confidence: number
    alias_boost_confidence: number
  }
  aliases: AliasRow[]
  preferences: PreferenceRow[]
  updated_at: number
}

export const MEMORY_SCHEMA_VERSION = 1 as const

export const DEFAULT_THRESHOLDS: Readonly<MemoryThresholds> = Object.freeze({
  directAliasConfidence: 0.82,
  preferenceContextConfidence: 0.76,
  aliasBoostConfidence: 0.48,
  staleRefreshLimit: 3,
  minRetainedConfidence: 0.08,
  maxAliases: 250,
  maxPreferences: 120,
  maxEvents: 10_000,
})

const ALIAS_EVIDENCE = new Set<AliasEvidenceKind>([
  'discovery',
  'successful_status',
  'successful_action',
  'explicit_learning',
  'explicit_correction',
])
const PREFERENCE_EVIDENCE = new Set<PreferenceEvidenceKind>(['implicit', 'explicit', 'correction'])
const METRICS = new Set<PreferenceMetric>(['temperature', 'volume_level', 'brightness_pct'])

type SqlRow = Record<string, unknown>

function normalizeName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function clampConfidence(value: unknown): number {
  const numeric = Number(value)
  return Math.max(0, Math.min(0.99, Number.isFinite(numeric) ? numeric : 0))
}

function sanitizePreferenceValue(metric: PreferenceMetric, value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (metric === 'volume_level') return value >= 0 && value <= 1 ? value : null
  if (metric === 'brightness_pct') return value >= 0 && value <= 100 ? value : null
  return value >= 5 && value <= 40 ? value : null
}

function aliasId(
  normalizedPhrase: string,
  areaName: string | null,
  domain: string | null,
  entityId: string,
): string {
  return ['alias', normalizedPhrase, normalizeName(areaName || '*'), domain || '*', entityId].join(
    '|',
  )
}

function preferenceId(metric: PreferenceMetric, areaName: string | null, entityId: string): string {
  return ['preference', metric, normalizeName(areaName || '*'), entityId].join('|')
}

function sameScope(
  leftArea: unknown,
  rightArea: string | null,
  leftDomain: unknown,
  rightDomain: string | null,
): boolean {
  return (
    normalizeName(leftArea || '*') === normalizeName(rightArea || '*') &&
    (normalizeNullable(leftDomain) || '*') === (rightDomain || '*')
  )
}

function initialAliasConfidence(kind: AliasEvidenceKind): number {
  if (kind === 'explicit_correction') return 0.92
  if (kind === 'explicit_learning') return 0.84
  if (kind === 'successful_action') return 0.62
  if (kind === 'successful_status') return 0.5
  return 0.34
}

function applyAliasEvidence(current: number | null, kind: AliasEvidenceKind): number {
  if (current === null) return initialAliasConfidence(kind)
  if (kind === 'explicit_correction' || kind === 'explicit_learning') {
    return Math.max(
      kind === 'explicit_correction' ? 0.92 : 0.84,
      clampConfidence(current + (1 - current) * 0.3),
    )
  }
  if (kind === 'successful_action') {
    return Math.max(0.62, clampConfidence(current + (1 - current) * 0.18))
  }
  if (kind === 'successful_status') {
    return Math.max(0.5, Math.min(0.78, clampConfidence(current + (1 - current) * 0.1)))
  }
  return Math.max(0.34, Math.min(0.68, clampConfidence(current + (1 - current) * 0.06)))
}

function applyPreferenceEvidence(
  current: { value: number; confidence: number } | null,
  metric: PreferenceMetric,
  kind: PreferenceEvidenceKind,
  newValue: number,
): { value: number; confidence: number } {
  if (!current) {
    return {
      value: newValue,
      confidence: kind === 'correction' ? 0.88 : kind === 'explicit' ? 0.76 : 0.35,
    }
  }

  if (kind === 'correction') return { value: newValue, confidence: 0.88 }

  const tolerance = metric === 'temperature' ? 1.0 : metric === 'brightness_pct' ? 12 : 0.12
  const distance = Math.abs(newValue - current.value)
  let value: number
  let confidence: number

  if (distance <= tolerance) {
    value = current.value * 0.72 + newValue * 0.28
    confidence = clampConfidence(current.confidence + (1 - current.confidence) * 0.16)
  } else {
    value = current.value * 0.45 + newValue * 0.55
    confidence = clampConfidence(Math.max(0.24, current.confidence * 0.72))
  }

  if (kind === 'explicit') confidence = Math.max(confidence, 0.76)
  return { value, confidence }
}

function asInt(value: unknown, fallback = 0): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback
}

function asAliasRow(row: unknown): AliasRow | null {
  if (!row || typeof row !== 'object') return null
  return row as AliasRow
}

function asPreferenceRow(row: unknown): PreferenceRow | null {
  if (!row || typeof row !== 'object') return null
  return row as PreferenceRow
}

export class HomeVoiceMemoryStore {
  readonly path: string
  readonly thresholds: MemoryThresholds
  private readonly db: DatabaseSync

  constructor(options: { path: string; thresholds?: Partial<MemoryThresholds> }) {
    if (!options.path) throw new Error('A SQLite path is required.')
    mkdirSync(dirname(options.path), { recursive: true })
    this.path = options.path
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) }
    this.db = new DatabaseSync(options.path)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA synchronous = NORMAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec('PRAGMA busy_timeout = 5000;')
    this.migrate()
  }

  close(): void {
    this.db.close()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);

      CREATE TABLE IF NOT EXISTS aliases (
        id TEXT PRIMARY KEY,
        phrase TEXT NOT NULL,
        normalized_phrase TEXT NOT NULL,
        area_name TEXT,
        domain TEXT,
        entity_id TEXT NOT NULL,
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 0.99),
        observations INTEGER NOT NULL DEFAULT 0,
        successful_uses INTEGER NOT NULL DEFAULT 0,
        contradictions INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER,
        stale_misses INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_alias_lookup ON aliases(normalized_phrase, area_name, domain, confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_alias_entity ON aliases(entity_id);

      CREATE TABLE IF NOT EXISTS preferences (
        id TEXT PRIMARY KEY,
        metric TEXT NOT NULL CHECK(metric IN ('temperature','volume_level','brightness_pct')),
        area_name TEXT,
        entity_id TEXT NOT NULL,
        value REAL NOT NULL,
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 0.99),
        observations INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER,
        stale_misses INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_pref_lookup ON preferences(metric, area_name, entity_id, confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_pref_entity ON preferences(entity_id);

      CREATE TABLE IF NOT EXISTS learning_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        source_device TEXT,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_learning_events_created ON learning_events(created_at DESC);
    `)

    this.db
      .prepare(
        `
      INSERT INTO metadata(key, value) VALUES('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
      )
      .run(String(MEMORY_SCHEMA_VERSION))
    this.db
      .prepare(
        `INSERT INTO metadata(key, value) VALUES('revision', '0') ON CONFLICT(key) DO NOTHING`,
      )
      .run()
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {}
      throw error
    }
  }

  private revision(): number {
    const row = this.db.prepare(`SELECT value FROM metadata WHERE key = 'revision'`).get() as
      SqlRow | undefined
    return asInt(row?.value, 0)
  }

  private bumpRevision(): number {
    const revision = this.revision() + 1
    this.db.prepare(`UPDATE metadata SET value = ? WHERE key = 'revision'`).run(String(revision))
    return revision
  }

  private recordEvent(input: {
    eventId?: string | undefined
    eventType: string
    subjectId: string
    sourceDevice?: string | null | undefined
    payload: unknown
    createdAt: number
  }): { eventId: string; inserted: boolean } {
    const id = normalizeNullable(input.eventId) || randomUUID()
    const result = this.db
      .prepare(
        `
      INSERT OR IGNORE INTO learning_events(event_id, event_type, subject_id, source_device, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        input.eventType,
        input.subjectId,
        normalizeNullable(input.sourceDevice),
        JSON.stringify(input.payload ?? {}),
        input.createdAt,
      )
    return { eventId: id, inserted: Number(result.changes) === 1 }
  }

  private trimEvents(): void {
    const max = Math.max(100, asInt(this.thresholds.maxEvents, DEFAULT_THRESHOLDS.maxEvents))
    this.db
      .prepare(
        `
      DELETE FROM learning_events WHERE event_id IN (
        SELECT event_id FROM learning_events ORDER BY created_at DESC LIMIT -1 OFFSET ?
      )
    `,
      )
      .run(max)
  }

  private trimAggregates(): void {
    this.db
      .prepare(`DELETE FROM aliases WHERE confidence < ? AND deleted_at IS NULL`)
      .run(this.thresholds.minRetainedConfidence)
    this.db
      .prepare(`DELETE FROM preferences WHERE confidence < ? AND deleted_at IS NULL`)
      .run(this.thresholds.minRetainedConfidence)
    const now = Date.now()
    this.db
      .prepare(
        `
      UPDATE aliases SET deleted_at = COALESCE(deleted_at, ?)
      WHERE id IN (
        SELECT id FROM aliases WHERE deleted_at IS NULL
        ORDER BY confidence DESC, updated_at DESC LIMIT -1 OFFSET ?
      )
    `,
      )
      .run(now, this.thresholds.maxAliases)
    this.db
      .prepare(
        `
      UPDATE preferences SET deleted_at = COALESCE(deleted_at, ?)
      WHERE id IN (
        SELECT id FROM preferences WHERE deleted_at IS NULL
        ORDER BY confidence DESC, updated_at DESC LIMIT -1 OFFSET ?
      )
    `,
      )
      .run(now, this.thresholds.maxPreferences)
  }

  observeAlias(input: AliasObservation): {
    ok: true
    duplicate: boolean
    event_id: string
    revision: number
    alias: AliasRow | null
  } {
    const phrase = normalizeNullable(input.phrase)
    const entityId = normalizeNullable(input.entity_id)
    if (!phrase || !entityId) throw new Error('phrase and entity_id are required.')
    if (!ALIAS_EVIDENCE.has(input.evidence))
      throw new Error(`Invalid alias evidence: ${String(input.evidence)}`)

    const normalizedPhrase = normalizeName(phrase)
    if (normalizedPhrase.length < 2) throw new Error('The normalized phrase is too short.')
    const areaName = normalizeNullable(input.area_name)
    const domain = normalizeNullable(input.domain)
    const id = aliasId(normalizedPhrase, areaName, domain, entityId)
    const at = Number.isFinite(input.at) ? Math.trunc(input.at as number) : Date.now()

    return this.transaction(() => {
      const recorded = this.recordEvent({
        eventId: input.event_id,
        eventType: `alias:${input.evidence}`,
        subjectId: id,
        sourceDevice: input.source_device,
        payload: { phrase, normalizedPhrase, areaName, domain, entityId, evidence: input.evidence },
        createdAt: at,
      })
      if (!recorded.inserted) {
        return {
          ok: true as const,
          duplicate: true,
          event_id: recorded.eventId,
          revision: this.revision(),
          alias: this.getAliasById(id),
        }
      }

      if (
        input.evidence === 'successful_action' ||
        input.evidence === 'explicit_learning' ||
        input.evidence === 'explicit_correction'
      ) {
        const competitors = this.db
          .prepare(
            `
          SELECT * FROM aliases WHERE id <> ? AND normalized_phrase = ? AND entity_id <> ? AND deleted_at IS NULL
        `,
          )
          .all(id, normalizedPhrase, entityId) as SqlRow[]

        for (const competitor of competitors) {
          if (!sameScope(competitor.area_name, areaName, competitor.domain, domain)) continue
          const factor = input.evidence === 'explicit_correction' ? 0.25 : 0.55
          const confidence = clampConfidence(Number(competitor.confidence) * factor)
          this.db
            .prepare(
              `
            UPDATE aliases SET confidence = ?, contradictions = contradictions + 1, updated_at = ? WHERE id = ?
          `,
            )
            .run(confidence, at, String(competitor.id))
          this.recordEvent({
            eventId: `${recorded.eventId}:contradiction:${String(competitor.id)}`,
            eventType: 'alias:contradiction',
            subjectId: String(competitor.id),
            sourceDevice: input.source_device,
            payload: {
              winning_alias_id: id,
              severity: input.evidence === 'explicit_correction' ? 'explicit_correction' : 'normal',
            },
            createdAt: at,
          })
        }
      }

      const current = this.db.prepare(`SELECT * FROM aliases WHERE id = ?`).get(id) as
        SqlRow | undefined
      const confidence = applyAliasEvidence(
        current ? Number(current.confidence) : null,
        input.evidence,
      )
      const successful =
        input.evidence === 'successful_action' ||
        input.evidence === 'explicit_learning' ||
        input.evidence === 'explicit_correction'
      const touchedLastUsed = successful || input.evidence === 'successful_status'

      if (!current) {
        this.db
          .prepare(
            `
          INSERT INTO aliases(
            id, phrase, normalized_phrase, area_name, domain, entity_id,
            confidence, observations, successful_uses, contradictions,
            created_at, updated_at, last_used_at, stale_misses, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?, ?, 0, NULL)
        `,
          )
          .run(
            id,
            phrase,
            normalizedPhrase,
            areaName,
            domain,
            entityId,
            confidence,
            successful ? 1 : 0,
            at,
            at,
            touchedLastUsed ? at : null,
          )
      } else {
        this.db
          .prepare(
            `
          UPDATE aliases SET
            phrase = ?, confidence = ?, observations = observations + 1,
            successful_uses = successful_uses + ?, updated_at = ?,
            last_used_at = CASE WHEN ? THEN ? ELSE last_used_at END,
            stale_misses = 0, deleted_at = NULL
          WHERE id = ?
        `,
          )
          .run(phrase, confidence, successful ? 1 : 0, at, touchedLastUsed ? 1 : 0, at, id)
      }

      this.trimAggregates()
      this.trimEvents()
      const revision = this.bumpRevision()
      return {
        ok: true as const,
        duplicate: false,
        event_id: recorded.eventId,
        revision,
        alias: this.getAliasById(id),
      }
    })
  }

  observePreference(input: PreferenceObservation): {
    ok: true
    duplicate: boolean
    event_id: string
    revision: number
    preference: PreferenceRow | null
  } {
    if (!METRICS.has(input.metric))
      throw new Error(`Invalid preference metric: ${String(input.metric)}`)
    const entityId = normalizeNullable(input.entity_id)
    if (!entityId) throw new Error('entity_id is required.')
    const evidence = input.evidence ?? 'implicit'
    if (!PREFERENCE_EVIDENCE.has(evidence))
      throw new Error(`Invalid preference evidence: ${String(evidence)}`)
    const value = sanitizePreferenceValue(input.metric, input.value)
    if (value === null) throw new Error(`Value is invalid for metric ${input.metric}.`)

    const areaName = normalizeNullable(input.area_name)
    const id = preferenceId(input.metric, areaName, entityId)
    const at = Number.isFinite(input.at) ? Math.trunc(input.at as number) : Date.now()

    return this.transaction(() => {
      const recorded = this.recordEvent({
        eventId: input.event_id,
        eventType: `preference:${evidence}`,
        subjectId: id,
        sourceDevice: input.source_device,
        payload: { metric: input.metric, areaName, entityId, value, evidence },
        createdAt: at,
      })
      if (!recorded.inserted) {
        return {
          ok: true as const,
          duplicate: true,
          event_id: recorded.eventId,
          revision: this.revision(),
          preference: this.getPreferenceById(id),
        }
      }

      const current = this.db.prepare(`SELECT * FROM preferences WHERE id = ?`).get(id) as
        SqlRow | undefined
      const next = applyPreferenceEvidence(
        current ? { value: Number(current.value), confidence: Number(current.confidence) } : null,
        input.metric,
        evidence,
        value,
      )

      if (!current) {
        this.db
          .prepare(
            `
          INSERT INTO preferences(
            id, metric, area_name, entity_id, value, confidence, observations,
            created_at, updated_at, last_used_at, stale_misses, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, NULL)
        `,
          )
          .run(id, input.metric, areaName, entityId, next.value, next.confidence, at, at, at)
      } else {
        this.db
          .prepare(
            `
          UPDATE preferences SET
            value = ?, confidence = ?, observations = observations + 1,
            updated_at = ?, last_used_at = ?, stale_misses = 0, deleted_at = NULL
          WHERE id = ?
        `,
          )
          .run(next.value, next.confidence, at, at, id)
      }

      this.trimAggregates()
      this.trimEvents()
      const revision = this.bumpRevision()
      return {
        ok: true as const,
        duplicate: false,
        event_id: recorded.eventId,
        revision,
        preference: this.getPreferenceById(id),
      }
    })
  }

  reconcileCatalog(input: { entity_ids: string[]; at?: number | undefined }): {
    ok: true
    revision: number
    entity_count: number
    removed_aliases: number
    removed_preferences: number
  } {
    if (!Array.isArray(input.entity_ids)) throw new Error('entity_ids must be an array.')
    const current = new Set(
      input.entity_ids
        .filter(value => typeof value === 'string' && value.trim())
        .map(value => value.trim()),
    )
    const at = Number.isFinite(input.at) ? Math.trunc(input.at as number) : Date.now()
    const limit = Math.max(1, asInt(this.thresholds.staleRefreshLimit, 3))

    return this.transaction(() => {
      let changed = false
      let removedAliases = 0
      let removedPreferences = 0

      for (const table of ['aliases', 'preferences'] as const) {
        const rows = this.db
          .prepare(`SELECT id, entity_id, stale_misses FROM ${table} WHERE deleted_at IS NULL`)
          .all() as SqlRow[]
        for (const row of rows) {
          const id = String(row.id)
          const entityId = String(row.entity_id)
          if (current.has(entityId)) {
            if (Number(row.stale_misses) !== 0) {
              this.db.prepare(`UPDATE ${table} SET stale_misses = 0 WHERE id = ?`).run(id)
              changed = true
            }
            continue
          }

          const misses = Number(row.stale_misses) + 1
          if (misses >= limit) {
            this.db
              .prepare(
                `UPDATE ${table} SET stale_misses = ?, deleted_at = ?, updated_at = ? WHERE id = ?`,
              )
              .run(misses, at, at, id)
            if (table === 'aliases') removedAliases += 1
            else removedPreferences += 1
          } else {
            this.db.prepare(`UPDATE ${table} SET stale_misses = ? WHERE id = ?`).run(misses, id)
          }
          changed = true
        }
      }

      const revision = changed ? this.bumpRevision() : this.revision()
      return {
        ok: true as const,
        revision,
        entity_count: current.size,
        removed_aliases: removedAliases,
        removed_preferences: removedPreferences,
      }
    })
  }

  importLegacyStore(input: {
    aliases?: unknown[]
    preferences?: unknown[]
    source_device?: string | null
  }): {
    ok: true
    revision: number
    imported_aliases: number
    imported_preferences: number
  } {
    const aliases = Array.isArray(input.aliases) ? input.aliases : []
    const preferences = Array.isArray(input.preferences) ? input.preferences : []
    const sourceDevice = normalizeNullable(input.source_device) || 'legacy-import'

    return this.transaction(() => {
      let importedAliases = 0
      let importedPreferences = 0

      for (const rawValue of aliases) {
        if (!rawValue || typeof rawValue !== 'object') continue
        const raw = rawValue as Record<string, unknown>
        const phrase = normalizeNullable(raw.phrase)
        const entityId = normalizeNullable(raw.entity_id)
        if (!phrase || !entityId) continue
        const normalizedPhrase = normalizeName(phrase)
        const areaName = normalizeNullable(raw.area_name)
        const domain = normalizeNullable(raw.domain)
        const id = aliasId(normalizedPhrase, areaName, domain, entityId)
        const confidence = clampConfidence(raw.confidence)
        const createdAt = asInt(raw.created_at, Date.now())
        const updatedAt = Math.max(createdAt, asInt(raw.updated_at, createdAt))
        const eventId = `legacy-alias:${id}:${updatedAt}`
        const record = this.recordEvent({
          eventId,
          eventType: 'alias:legacy_snapshot',
          subjectId: id,
          sourceDevice,
          payload: raw,
          createdAt: updatedAt,
        })
        if (!record.inserted) continue

        const existing = this.db.prepare(`SELECT * FROM aliases WHERE id = ?`).get(id) as
          SqlRow | undefined
        if (!existing || updatedAt >= Number(existing.updated_at)) {
          this.db
            .prepare(
              `
            INSERT INTO aliases(
              id, phrase, normalized_phrase, area_name, domain, entity_id,
              confidence, observations, successful_uses, contradictions,
              created_at, updated_at, last_used_at, stale_misses, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            ON CONFLICT(id) DO UPDATE SET
              phrase=excluded.phrase, confidence=excluded.confidence,
              observations=excluded.observations, successful_uses=excluded.successful_uses,
              contradictions=excluded.contradictions,
              created_at=MIN(aliases.created_at, excluded.created_at),
              updated_at=excluded.updated_at, last_used_at=excluded.last_used_at,
              stale_misses=0, deleted_at=NULL
          `,
            )
            .run(
              id,
              phrase,
              normalizedPhrase,
              areaName,
              domain,
              entityId,
              confidence,
              Math.max(0, asInt(raw.observations)),
              Math.max(0, asInt(raw.successful_uses)),
              Math.max(0, asInt(raw.contradictions)),
              createdAt,
              updatedAt,
              Number.isFinite(Number(raw.last_used_at))
                ? Math.trunc(Number(raw.last_used_at))
                : null,
            )
          importedAliases += 1
        }
      }

      for (const rawValue of preferences) {
        if (!rawValue || typeof rawValue !== 'object') continue
        const raw = rawValue as Record<string, unknown>
        const metric = raw.metric
        if (!METRICS.has(metric as PreferenceMetric)) continue
        const typedMetric = metric as PreferenceMetric
        const entityId = normalizeNullable(raw.entity_id)
        if (!entityId) continue
        const value = sanitizePreferenceValue(typedMetric, raw.value)
        if (value === null) continue
        const areaName = normalizeNullable(raw.area_name)
        const id = preferenceId(typedMetric, areaName, entityId)
        const confidence = clampConfidence(raw.confidence)
        const createdAt = asInt(raw.created_at, Date.now())
        const updatedAt = Math.max(createdAt, asInt(raw.updated_at, createdAt))
        const eventId = `legacy-preference:${id}:${updatedAt}`
        const record = this.recordEvent({
          eventId,
          eventType: 'preference:legacy_snapshot',
          subjectId: id,
          sourceDevice,
          payload: raw,
          createdAt: updatedAt,
        })
        if (!record.inserted) continue

        const existing = this.db.prepare(`SELECT * FROM preferences WHERE id = ?`).get(id) as
          SqlRow | undefined
        if (!existing || updatedAt >= Number(existing.updated_at)) {
          this.db
            .prepare(
              `
            INSERT INTO preferences(
              id, metric, area_name, entity_id, value, confidence, observations,
              created_at, updated_at, last_used_at, stale_misses, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            ON CONFLICT(id) DO UPDATE SET
              value=excluded.value, confidence=excluded.confidence,
              observations=excluded.observations,
              created_at=MIN(preferences.created_at, excluded.created_at),
              updated_at=excluded.updated_at, last_used_at=excluded.last_used_at,
              stale_misses=0, deleted_at=NULL
          `,
            )
            .run(
              id,
              typedMetric,
              areaName,
              entityId,
              value,
              confidence,
              Math.max(0, asInt(raw.observations)),
              createdAt,
              updatedAt,
              Number.isFinite(Number(raw.last_used_at))
                ? Math.trunc(Number(raw.last_used_at))
                : null,
            )
          importedPreferences += 1
        }
      }

      this.trimAggregates()
      this.trimEvents()
      const changed = importedAliases > 0 || importedPreferences > 0
      const revision = changed ? this.bumpRevision() : this.revision()
      return {
        ok: true as const,
        revision,
        imported_aliases: importedAliases,
        imported_preferences: importedPreferences,
      }
    })
  }

  getAliasById(id: string): AliasRow | null {
    return asAliasRow(
      this.db.prepare(`SELECT * FROM aliases WHERE id = ? AND deleted_at IS NULL`).get(id),
    )
  }

  getPreferenceById(id: string): PreferenceRow | null {
    return asPreferenceRow(
      this.db.prepare(`SELECT * FROM preferences WHERE id = ? AND deleted_at IS NULL`).get(id),
    )
  }

  getContext(options: { includeLowConfidence?: boolean } = {}): MemoryContext {
    const includeLowConfidence = options.includeLowConfidence ?? true
    const aliasMin = includeLowConfidence
      ? this.thresholds.minRetainedConfidence
      : this.thresholds.directAliasConfidence
    const preferenceMin = includeLowConfidence
      ? this.thresholds.minRetainedConfidence
      : this.thresholds.preferenceContextConfidence
    const aliases = this.db
      .prepare(
        `
      SELECT * FROM aliases WHERE deleted_at IS NULL AND confidence >= ?
      ORDER BY confidence DESC, updated_at DESC LIMIT ?
    `,
      )
      .all(aliasMin, this.thresholds.maxAliases) as unknown as AliasRow[]
    const preferences = this.db
      .prepare(
        `
      SELECT * FROM preferences WHERE deleted_at IS NULL AND confidence >= ?
      ORDER BY confidence DESC, updated_at DESC LIMIT ?
    `,
      )
      .all(preferenceMin, this.thresholds.maxPreferences) as unknown as PreferenceRow[]

    return {
      version: MEMORY_SCHEMA_VERSION,
      revision: this.revision(),
      thresholds: {
        direct_alias_confidence: this.thresholds.directAliasConfidence,
        preference_context_confidence: this.thresholds.preferenceContextConfidence,
        alias_boost_confidence: this.thresholds.aliasBoostConfidence,
      },
      aliases,
      preferences,
      updated_at: Math.max(
        0,
        ...aliases.map(row => Number(row.updated_at) || 0),
        ...preferences.map(row => Number(row.updated_at) || 0),
      ),
    }
  }

  diagnostics(): {
    ok: boolean
    schema_version: number
    revision: number
    database_path: string
    active_aliases: number
    active_preferences: number
    learning_events: number
    quick_check: string | null
  } {
    const activeAliases = this.db
      .prepare(`SELECT COUNT(*) AS n FROM aliases WHERE deleted_at IS NULL`)
      .get() as SqlRow | undefined
    const activePreferences = this.db
      .prepare(`SELECT COUNT(*) AS n FROM preferences WHERE deleted_at IS NULL`)
      .get() as SqlRow | undefined
    const events = this.db.prepare(`SELECT COUNT(*) AS n FROM learning_events`).get() as
      SqlRow | undefined
    const dbCheck = this.db.prepare(`PRAGMA quick_check`).get() as SqlRow | undefined
    const quickCheck = typeof dbCheck?.quick_check === 'string' ? dbCheck.quick_check : null
    return {
      ok: quickCheck === 'ok',
      schema_version: MEMORY_SCHEMA_VERSION,
      revision: this.revision(),
      database_path: this.path,
      active_aliases: asInt(activeAliases?.n),
      active_preferences: asInt(activePreferences?.n),
      learning_events: asInt(events?.n),
      quick_check: quickCheck,
    }
  }
}

export const memoryInternalsForTests = {
  normalizeName,
  sanitizePreferenceValue,
  aliasId,
  preferenceId,
  applyAliasEvidence,
  applyPreferenceEvidence,
}
