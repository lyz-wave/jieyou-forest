import { app, ipcMain, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { CH, type DiscussInput, type ModelConfigDto, type SaveRingInput, type SendChannel, type SubmitInput, type TranscribeInput } from '../shared/ipc'
import { transcribeAudio } from '../shared/asr'
import rules from './gate/rules.json'
import { applyCorrection, capabilitiesFor, evaluateGate, type RulesFile } from './gate/gate'
import { createModelClient, loadConfig, testConnection, type ModelClient } from './model/client'
import { runReceive } from './orchestrate/receive'
import { runReflection, type ThreeViews } from './orchestrate/reflection'
import { canEnterReflection, SessionMemory } from './orchestrate/session'
import { openDatabase } from './store/db'
import * as repo from './store/repo'
import { findResonantRing } from '../shared/resonance'
import type { ReviewDraft, SessionPath } from '../shared/types'


const RULES = rules as RulesFile

interface Context {
  memory: SessionMemory
  db: ReturnType<typeof openDatabase>
  model: ModelClient
}

let ctx: Context | null = null

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const db = openDatabase(join(app.getPath('userData'), 'forest.db'))
  let effectiveConfig = loadConfig()
  const savedConfigRaw = repo.getConfig(db, 'model_config')
  if (savedConfigRaw) {
    try {
      effectiveConfig = { ...effectiveConfig, ...JSON.parse(savedConfigRaw) }
    } catch {}
  }
  ctx = { memory: new SessionMemory(), db, model: createModelClient(effectiveConfig) }

  // 形参类型是 CH 值的联合：这里写裸字面量会编译不过
  const send = (channel: SendChannel, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload)
  }
  const must = (): Context => {
    if (!ctx) throw new Error('主进程尚未就绪')
    return ctx
  }

  ipcMain.handle(CH.invoke.submit, async (_e, payload: SubmitInput) => {
    const c = must()
    if (!payload.input.trim()) throw new Error('空白内容不算一次表达')

    const gate = evaluateGate({ text: payload.input }, RULES)
    const s = c.memory.create(payload.input, gate, { emotion: payload.emotion, intensity: payload.intensity })
    repo.recordEvent(c.db, { anonymousSessionId: s.id, eventName: 'expression_submitted', resultCode: gate.reasonCode })
    if (gate.level !== 'L3') {
      repo.recordEvent(c.db, { anonymousSessionId: s.id, eventName: 'safety_verdict', resultCode: gate.level.toLowerCase() })
    }
    send(CH.send.verdict, { sessionId: s.id, level: gate.level })
    send(CH.send.state, { sessionId: s.id, status: s.status })

    // L1 不生树、不出休息卡、不思考，也不把这段话发去调模型
    if (gate.level === 'L1') {
      return { sessionId: s.id, capabilities: capabilitiesFor(gate.level), banner: null }
    }

    const outcome = await runReceive({
      model: c.model,
      input: payload.input,
      timeoutMs: loadConfig().receiveTimeoutMs,
      emit: (delta, done) => send(CH.send.receive, { sessionId: s.id, delta, done }),
    })
    s.status = 'choosing'
    s.usedFallback = outcome.isFallback
    if (outcome.errorCode) {
      repo.recordEvent(c.db, { anonymousSessionId: s.id, eventName: 'generation_failed', resultCode: outcome.errorCode })
    }
    send(CH.send.state, { sessionId: s.id, status: s.status })
    const localRings = repo.listRings(c.db)
    const resonance = findResonantRing(payload.input, localRings)
    return {
      sessionId: s.id,
      capabilities: capabilitiesFor(gate.level),
      banner: outcome.banner ?? null,
      resonance,
    }
  })


  ipcMain.handle(CH.invoke.retryReceive, async (_e, { sessionId }: { sessionId: string }) => {
    const c = must()
    const s = c.memory.get(sessionId)
    if (!s) throw new Error('会话不存在或已随内存消失')
    const outcome = await runReceive({
      model: c.model, input: s.input, timeoutMs: loadConfig().receiveTimeoutMs,
      emit: (delta, done) => send(CH.send.receive, { sessionId, delta, done }),
    })
    s.usedFallback = outcome.isFallback
    return { banner: outcome.banner ?? null }
  })

  ipcMain.handle(CH.invoke.correct, (_e, { sessionId }: { sessionId: string }) => {
    const c = must()
    const s = c.memory.get(sessionId)
    if (!s) throw new Error('会话不存在')
    const fixed = applyCorrection(s.gate)
    c.memory.applyCorrection(sessionId, fixed)
    repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'safety_corrected', resultCode: fixed.reasonCode })
    return { level: fixed.level, capabilities: capabilitiesFor(fixed.level) }
  })

  ipcMain.handle(CH.invoke.choosePath, (_e, { sessionId, path }: { sessionId: string; path: SessionPath }) => {
    const c = must()
    const s = c.memory.choosePath(sessionId, path)
    repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'path_chosen', mode: path })
    send(CH.send.state, { sessionId, status: s.status })
    return { status: s.status }
  })

  ipcMain.handle(CH.invoke.consent, async (_e, { sessionId }: { sessionId: string }) => {
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
      send(CH.send.reflection, { sessionId, card, delta: text, done: true })
    }
    const analysis = {
      objectiveFact: outcome.quotedInput || s.input,
      subjectiveAssumption: outcome.assumptions?.[0] || '我担心事情会彻底失控',
      distortionBadge: '灾难化',
      socraticQuestions: {
        guardian: '守护者反问：你真正想保护的需求或边界是什么？',
        explorer: '探索者反问：有没有一个低成本、可撤回的小试验？',
        outsider: '局外人反问：除了眼前这个解释，还有哪些可能？',
      },
      microExperiment: {
        action: '尝试向相关方核实一次具体客观事实',
        observableCriterion: '记录下真实的答复，对比自己预设的脑补',
        estimatedMinutes: 5,
      },
    }
    return { ok: true as const, quotedInput: outcome.quotedInput, assumptions: outcome.assumptions, analysis }
  })

  ipcMain.handle(CH.invoke.cancelReflect, (_e, { sessionId }: { sessionId: string }) => {
    const c = must()
    const s = c.memory.cancelReflect(sessionId)
    repo.recordEvent(c.db, { anonymousSessionId: sessionId, eventName: 'reflection_exited' })
    return { status: s.status }
  })

  ipcMain.handle(CH.invoke.saveRing, (_e, { sessionId, draft, idempotencyKey }: SaveRingInput) => {
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

  ipcMain.handle(CH.invoke.listRings, () => repo.listRings(must().db))

  ipcMain.handle(CH.invoke.getRing, (_e, { id }: { id: string }) => repo.getRing(must().db, id))

  ipcMain.handle(CH.invoke.deleteRing, (_e, { id }: { id: string }) => {
    const c = must()
    const deleted = repo.deleteRing(c.db, id)
    if (deleted) repo.recordEvent(c.db, { anonymousSessionId: 'local', eventName: 'ring_deleted' })
    // 删除后列表与详情都必须读不到
    return { deleted, stillReadable: repo.getRing(c.db, id) != null }
  })

  ipcMain.handle(CH.invoke.saveReview, (_e, { ringId, draft }: { ringId: string; draft: ReviewDraft }) => {
    const c = must()
    return { reviewId: repo.saveReview(c.db, ringId, draft) }
  })

  ipcMain.handle(CH.invoke.clearAll, () => {
    const c = must()
    repo.clearAll(c.db)
    return { empty: repo.isDatabaseEmpty(c.db) }
  })

  // 语音转文字。渲染层只负责录音，网络请求放在主进程：
  // 密钥不出主进程、也不受渲染层 CSP 影响。
  const readModelConfig = (): ModelConfigDto => {
    const raw = repo.getConfig(db, 'model_config')
    if (raw) {
      try {
        return JSON.parse(raw) as ModelConfigDto
      } catch {}
    }
    return loadConfig()
  }

  ipcMain.handle(CH.invoke.transcribe, async (_e, payload: TranscribeInput) => {
    if (!payload?.audio || !payload.audio.byteLength) {
      return { ok: false, error: '没有录到声音' }
    }
    const cfg = readModelConfig()
    if (!cfg.apiKey?.trim()) {
      return { ok: false, error: '还没有配置 API Key：语音识别要走你在「模型设置」里填写的端点' }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000)
    try {
      const text = await transcribeAudio({
        audio: new Uint8Array(payload.audio),
        mimeType: payload.mimeType,
        config: { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.asrModel },
        signal: controller.signal,
      })
      return { ok: true, text }
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? '识别超时（60 秒）' : err?.message || '语音识别失败'
      return { ok: false, error: msg }
    } finally {
      clearTimeout(timer)
    }
  })

  ipcMain.handle(CH.invoke.getModelConfig, () => {
    const c = must()
    const raw = repo.getConfig(c.db, 'model_config')
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch {}
    }
    return loadConfig()
  })

  ipcMain.handle(CH.invoke.saveModelConfig, (_e, cfg: ModelConfigDto) => {
    const c = must()
    repo.setConfig(c.db, 'model_config', JSON.stringify(cfg))
    c.model = createModelClient({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      receiveTimeoutMs: cfg.receiveTimeoutMs ?? 45_000,
      reflectTimeoutMs: cfg.reflectTimeoutMs ?? 30_000,
    })
    return { ok: true }
  })

  ipcMain.handle(CH.invoke.testModelConfig, async (_e, cfg: ModelConfigDto) => {
    return await testConnection({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      receiveTimeoutMs: cfg.receiveTimeoutMs ?? 45_000,
      reflectTimeoutMs: cfg.reflectTimeoutMs ?? 30_000,
    })
  })

  ipcMain.handle(CH.invoke.discuss, async (_e, payload: DiscussInput) => {
    const c = must()
    if (!c.model.available) {
      const fallbackReplies: Record<string, string> = {
        guardian: '我注意到你的疲惫与认真。你已经在承担很多了。如果现在允许自己放下 10% 的自责，你最想先给自己的边界留出什么空间？',
        explorer: '如果把这次的阻碍视作一个提示信号而非判决，你觉得它最想引导你发现哪种新的应对方式？哪怕只是一个小试验？',
        outsider: '跳出眼前的焦虑，设想一年后的你坐在安静的书房里回望今天，你最想对现在的自己说一句什么鼓励的话？',
        mirror: '当我们感到失控时，往往把“最坏的猜想”误认成了“必然的现实”。试问：眼前切实发生的事实，与你担心的未来，边界在哪里？',
      }
      const fallbackReply = fallbackReplies[payload.perspective] || '深呼吸，给自己的内心留一扇窗。你现在最需要的一份安心是什么？'
      send(CH.send.discussionDelta, {
        sessionId: payload.sessionId,
        perspective: payload.perspective,
        delta: fallbackReply,
        done: true,
      })
      return { ok: true, reply: fallbackReply }
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      let fullReply = ''
      for await (const chunk of c.model.discuss(payload, controller.signal)) {
        fullReply += chunk
        send(CH.send.discussionDelta, {
          sessionId: payload.sessionId,
          perspective: payload.perspective,
          delta: chunk,
          done: false,
        })
      }
      clearTimeout(timer)
      send(CH.send.discussionDelta, {
        sessionId: payload.sessionId,
        perspective: payload.perspective,
        delta: '',
        done: true,
      })
      return { ok: true, reply: fullReply }
    } catch (err: any) {
      return { ok: false, error: err.message || '讨论生成遇到问题' }
    }
  })

  ipcMain.handle(CH.invoke.demoReset, () => {
    const c = must()
    repo.clearAll(c.db)
    c.memory = new SessionMemory()
    return { empty: repo.isDatabaseEmpty(c.db) }
  })
}
