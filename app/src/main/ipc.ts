import { app, ipcMain, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import rules from './gate/rules.json'
import { applyCorrection, capabilitiesFor, evaluateGate, type RulesFile } from './gate/gate'
import { createModelClient, loadConfig, type ModelClient } from './model/client'
import { runReceive } from './orchestrate/receive'
import { runReflection, type ThreeViews } from './orchestrate/reflection'
import { canEnterReflection, SessionMemory } from './orchestrate/session'
import { openDatabase } from './store/db'
import * as repo from './store/repo'
import type { ReviewDraft, RingDraft, SessionPath, SubmitInput } from '../shared/types'

const RULES = rules as RulesFile

interface Context {
  memory: SessionMemory
  db: ReturnType<typeof openDatabase>
  model: ModelClient
}

let ctx: Context | null = null

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const db = openDatabase(join(app.getPath('userData'), 'forest.db'))
  ctx = { memory: new SessionMemory(), db, model: createModelClient(loadConfig()) }

  const send = (channel: string, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload)
  }
  const must = (): Context => {
    if (!ctx) throw new Error('主进程尚未就绪')
    return ctx
  }

  ipcMain.handle('session:submit', async (_e, payload: SubmitInput) => {
    const c = must()
    if (!payload.input.trim()) throw new Error('空白内容不算一次表达')

    const gate = evaluateGate({ text: payload.input }, RULES)
    const s = c.memory.create(payload.input, gate, { emotion: payload.emotion, intensity: payload.intensity })
    repo.recordEvent(c.db, { anonymousSessionId: s.id, eventName: 'expression_submitted', resultCode: gate.reasonCode })
    if (gate.level !== 'L3') {
      repo.recordEvent(c.db, { anonymousSessionId: s.id, eventName: 'safety_verdict', resultCode: gate.level.toLowerCase() })
    }
    send('safety:verdict', { sessionId: s.id, level: gate.level })
    send('state:changed', { sessionId: s.id, status: s.status })

    // L1 不生树、不出休息卡、不思考，也不把这段话发去调模型
    const outcome =
      gate.level === 'L1'
        ? { isFallback: false, banner: undefined as string | undefined, errorCode: undefined as string | undefined }
        : await runReceive({
            model: c.model,
            input: payload.input,
            timeoutMs: loadConfig().receiveTimeoutMs,
            emit: (delta, done) => send('stream:receive', { sessionId: s.id, delta, done }),
          })
    if (gate.level === 'L1') return { sessionId: s.id, capabilities: capabilitiesFor(gate.level), banner: null }
    s.status = 'choosing'
    s.usedFallback = outcome.isFallback
    if (outcome.errorCode) {
      repo.recordEvent(c.db, { anonymousSessionId: s.id, eventName: 'generation_failed', resultCode: outcome.errorCode })
    }
    send('state:changed', { sessionId: s.id, status: s.status })
    return { sessionId: s.id, capabilities: capabilitiesFor(gate.level), banner: outcome.banner ?? null }
  })

  ipcMain.handle('session:retryReceive', async (_e, { sessionId }: { sessionId: string }) => {
    const c = must()
    const s = c.memory.get(sessionId)
    if (!s) throw new Error('会话不存在或已随内存消失')
    const outcome = await runReceive({
      model: c.model, input: s.input, timeoutMs: loadConfig().receiveTimeoutMs,
      emit: (delta, done) => send('stream:receive', { sessionId, delta, done }),
    })
    s.usedFallback = outcome.isFallback
    return { banner: outcome.banner ?? null }
  })

  ipcMain.handle('safety:correct', (_e, { sessionId }: { sessionId: string }) => {
    const c = must()
    const s = c.memory.get(sessionId)
    if (!s) throw new Error('会话不存在')
    const fixed = applyCorrection(s.gate)
    c.memory.applyCorrection(sessionId, fixed)
    repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'safety_corrected', resultCode: fixed.reasonCode })
    return { level: fixed.level, capabilities: capabilitiesFor(fixed.level) }
  })

  ipcMain.handle('path:choose', (_e, { sessionId, path }: { sessionId: string; path: SessionPath }) => {
    const c = must()
    const s = c.memory.choosePath(sessionId, path)
    repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'path_chosen', mode: path })
    send('state:changed', { sessionId, status: s.status })
    return { status: s.status }
  })

  ipcMain.handle('reflect:consent', async (_e, { sessionId }: { sessionId: string }) => {
    const c = must()
    const s = c.memory.grantConsent(sessionId)
    repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'reflection_consented' })

    const outcome = await runReflection({
      model: c.model, input: s.input, consentAt: s.consentAt, timeoutMs: loadConfig().reflectTimeoutMs,
    })
    if (!outcome.ok) {
      repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'generation_failed', resultCode: 'reflect_' + outcome.reason })
      // 思考层不兜底：只报未完成，不产出任何内容
      return { ok: false as const, reason: outcome.reason }
    }
    const cards: Array<[keyof ThreeViews | 'mirror', string]> = [
      ['guardian', outcome.views.guardian],
      ['explorer', outcome.views.explorer],
      ['outsider', outcome.views.outsider],
      ['mirror', outcome.reframedQuestion ?? ''],
    ]
    for (const [card, text] of cards) {
      send('stream:reflection', { sessionId, card, delta: text, done: true })
    }
    return { ok: true as const, quotedInput: outcome.quotedInput, assumptions: outcome.assumptions }
  })

  ipcMain.handle('reflect:cancel', (_e, { sessionId }: { sessionId: string }) => {
    const c = must()
    const s = c.memory.cancelReflect(sessionId)
    repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'reflection_exited' })
    return { status: s.status }
  })

  ipcMain.handle('ring:save', (_e, { sessionId, draft, idempotencyKey }: { sessionId: string; draft: RingDraft; idempotencyKey: string }) => {
    const c = must()
    const s = c.memory.get(sessionId)
    if (!s) throw new Error('会话不存在或已随内存消失')
    if (s.mode === 'reflect' && !canEnterReflection(s)) throw new Error('没有同意记录，不能保存思考产物')

    // 用户按下保存 —— 这是整条链路上第一次往 SQLite 写东西（ADR-0002）
    repo.saveSession(c.db, {
      id: s.id, input: s.input, selectedEmotion: s.emotion, selectedIntensity: s.intensity,
      mode: s.mode ?? 'rest', reflectionConsentAt: s.consentAt, status: 'optional_save',
    })
    const ringId = repo.saveRing(c.db, s.id, draft, idempotencyKey)
    repo.recordEvent(c.db, { anonymousSessionId: s.id, eventName: 'ring_saved', mode: s.mode })
    return { ringId }
  })

  ipcMain.handle('ring:list', () => repo.listRings(must().db))

  ipcMain.handle('ring:get', (_e, { id }: { id: string }) => repo.getRing(must().db, id))

  ipcMain.handle('ring:delete', (_e, { id }: { id: string }) => {
    const c = must()
    const deleted = repo.deleteRing(c.db, id)
    if (deleted) repo.recordEvent(c.db, { anonymousSessionId: 'local', eventName: 'ring_deleted' })
    // 删除后列表与详情都必须读不到
    return { deleted, stillReadable: repo.getRing(c.db, id) != null }
  })

  ipcMain.handle('review:save', (_e, { ringId, draft }: { ringId: string; draft: ReviewDraft }) => {
    const c = must()
    return { reviewId: repo.saveReview(c.db, ringId, draft) }
  })

  ipcMain.handle('data:clearAll', () => {
    const c = must()
    repo.clearAll(c.db)
    return { empty: repo.isDatabaseEmpty(c.db) }
  })

  ipcMain.handle('demo:reset', () => {
    const c = must()
    repo.clearAll(c.db)
    c.memory = new SessionMemory()
    return { empty: repo.isDatabaseEmpty(c.db) }
  })
}
