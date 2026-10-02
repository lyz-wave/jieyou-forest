import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { ReviewDraft, RingDraft } from '../../shared/types'

export interface SaveSessionInput {
  id: string
  input: string
  selectedEmotion?: string
  selectedIntensity?: string
  mode: 'rest' | 'reflect'
  reflectionConsentAt?: string
  status: string
  isDemo?: boolean
}

/** 只在用户按下保存之后调用它。未保存的表达不落库（ADR-0002）。 */
export function saveSession(db: Database.Database, s: SaveSessionInput): void {
  db.prepare(
    `INSERT INTO session (id, input, selected_emotion, selected_intensity, mode,
       reflection_consent_at, status, is_demo)
     VALUES (@id, @input, @selectedEmotion, @selectedIntensity, @mode,
       @reflectionConsentAt, @status, @isDemo)
     ON CONFLICT(id) DO UPDATE SET
       input = excluded.input, mode = excluded.mode, status = excluded.status,
       reflection_consent_at = excluded.reflection_consent_at`,
  ).run({
    id: s.id,
    input: s.input,
    selectedEmotion: s.selectedEmotion ?? null,
    selectedIntensity: s.selectedIntensity ?? null,
    mode: s.mode,
    reflectionConsentAt: s.reflectionConsentAt ?? null,
    status: s.status,
    isDemo: s.isDemo ? 1 : 0,
  })
}

export function countSessions(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM session').get() as { n: number }).n
}

export function countRings(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM ring').get() as { n: number }).n
}

/** 行动年轮的必填校验。陪伴年轮不校验、不强制复盘。 */
export function assertRingDraft(draft: RingDraft, now = Date.now()): void {
  if (!draft.userNote.trim()) throw new Error('年轮缺少用户自己的那句话')
  if (draft.saveOriginal && !draft.originalText?.trim()) throw new Error('打开了保存原文，但没有原文')
  if (draft.type !== 'action') return
  if (!draft.action?.trim()) throw new Error('行动年轮缺少一个小行动')
  if (!draft.criterion?.trim()) throw new Error('行动年轮缺少可观察的判据')
  if (!draft.reviewDue) throw new Error('行动年轮缺少复盘日期')
  if (new Date(draft.reviewDue).getTime() <= now) throw new Error('复盘日期必须在未来')
}

/** 幂等：同一个 idempotencyKey 只产生一圈年轮。 */
export function saveRing(
  db: Database.Database,
  sessionId: string,
  draft: RingDraft,
  idempotencyKey: string,
  opts: { isDemo?: boolean; now?: () => number } = {},
): string {
  const existing = db.prepare('SELECT id FROM ring WHERE idempotency_key = ?').get(idempotencyKey) as
    | { id: string }
    | undefined
  if (existing) return existing.id

  assertRingDraft(draft, (opts.now ?? Date.now)())
  const id = randomUUID()
  try {
    db.prepare(
      `INSERT INTO ring (id, session_id, type, user_note, save_original, original_text,
         user_decision, action, criterion, review_due, created_at, is_demo, idempotency_key)
       VALUES (@id, @sessionId, @type, @userNote, @saveOriginal, @originalText,
         @userDecision, @action, @criterion, @reviewDue, @createdAt, @isDemo, @key)`,
    ).run({
      id,
      sessionId,
      type: draft.type,
      userNote: draft.userNote,
      saveOriginal: draft.saveOriginal ? 1 : 0,
      originalText: draft.saveOriginal ? (draft.originalText ?? null) : null,
      userDecision: draft.userDecision ?? null,
      action: draft.action ?? null,
      criterion: draft.criterion ?? null,
      reviewDue: draft.reviewDue ?? null,
      createdAt: new Date((opts.now ?? Date.now)()).toISOString(),
      isDemo: opts.isDemo ? 1 : 0,
      key: idempotencyKey,
    })
  } catch {
    const raced = db.prepare('SELECT id FROM ring WHERE idempotency_key = ?').get(idempotencyKey) as
      | { id: string }
      | undefined
    if (raced) return raced.id
    throw new Error('年轮写入失败')
  }
  return id
}

export function listRings(db: Database.Database): unknown[] {
  return db.prepare('SELECT * FROM ring ORDER BY created_at DESC').all()
}

export function getRing(db: Database.Database, id: string): unknown {
  return db.prepare('SELECT * FROM ring WHERE id = ?').get(id)
}

/** 删除后列表与详情都必须读不到（PRD F06 验收）。 */
export function deleteRing(db: Database.Database, id: string): boolean {
  const info = db.prepare('DELETE FROM ring WHERE id = ?').run(id)
  return info.changes > 0
}

export function saveReview(db: Database.Database, ringId: string, draft: ReviewDraft): string {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO review (id, ring_id, executed, observed_result, premise_update, next_step, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, ringId, draft.executed ? 1 : 0, draft.observedResult,
    draft.premiseUpdate ?? null, draft.nextStep ?? null, new Date().toISOString(),
  )
  return id
}

/** 只记类别，永不记正文。安全判定也走这里（safety_l1 / safety_l2 / safety_corrected）。 */
export function recordEvent(
  db: Database.Database,
  e: { anonymousSessionId: string; eventName: string; mode?: string; durationMs?: number; resultCode?: string },
): void {
  db.prepare(
    `INSERT INTO interaction_event (anonymous_session_id, event_name, mode, duration_ms, result_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(e.anonymousSessionId, e.eventName, e.mode ?? null, e.durationMs ?? null, e.resultCode ?? null, new Date().toISOString())
}

export function clearAll(db: Database.Database): void {
  for (const t of ['review', 'ring', 'reflection', 'session', 'interaction_event']) {
    db.prepare(`DELETE FROM ${t}`).run()
  }
  db.exec('VACUUM')
}

/** 清空之后要能校验（ADR-0002 第二条配套）。 */
export function isDatabaseEmpty(db: Database.Database): boolean {
  const tables = ['session', 'reflection', 'ring', 'review', 'interaction_event']
  return tables.every(
    (t) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n === 0,
  )
}
