import { app, ipcMain, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import {
  CH,
  type CognitiveAnalysis,
  type DiscussInput,
  type ModelConfigDto,
  type SaveRingInput,
  type SendChannel,
  type SubmitInput,
  type TranscribeInput,
  TranscribeResult,
} from '../shared/ipc'
import { transcribeAudio } from '../shared/asr'
import rules from '../shared/gate/rules.json'
import { applyCorrection, capabilitiesFor, evaluateGate, type RulesFile } from '../shared/gate/gate'
import { createModelClient, listModels, loadConfig, testConnection, type ModelClient } from '../shared/model/client'
import { hasLocalWhisper, transcribeLocal } from './voice/transcribe'
import { runReceive } from '../shared/orchestrate/receive'
import { runReflection, type ThreeViews } from '../shared/orchestrate/reflection'
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
    const s = c.memory.create(payload.input, gate)
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
    // 只呈现模型真的产出的内容。
    // 这里原本塞着硬编码的「灾难化」标签、兜底的脑补推论、三段通用反问与一个通用微行动：
    // 既是给用户的心理状态贴诊断标签（PRD §8.1 明令禁止「不能诊断心理状态」），
    // 也是把编造的内容冒充成对这一次输入的分析（ADR-0004）。
    const analysis: CognitiveAnalysis = {
      quotedInput: (outcome.quotedInput ?? []).filter((q) => typeof q === 'string' && q.trim().length > 0),
      assumptions: outcome.assumptions ?? [],
      reframedQuestion: outcome.reframedQuestion ?? '',
      socraticQuestions: outcome.socraticQuestions,
      microExperiment: outcome.microExperiment,
      promptVersion: outcome.promptVersion,
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
      id: s.id, input: s.input,
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

  ipcMain.handle(CH.invoke.listReviews, (_e, p: { ringId?: string } = {}) => {
    const c = must()
    return repo.listReviews(c.db, p.ringId)
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

  // 语音转写：**本地优先，云端兜底**。
  //
  // 1) 本机 whisper.cpp —— 不需要任何服务商支持，音频不出这台电脑。
  //    在默认配置下这是唯一能跑通的路：实测 Command Code 与 OpenCode Zen 的
  //    /audio/transcriptions 都是 404，模型列表里也没有音频模型。
  // 2) 退回用户配置的端点（需要服务商支持 /audio/transcriptions）。
  //
  // 两条都失败时把两边的原因都报出来，而不是只留后一个——
  // 只说"云端 404"会让人以为配错了，其实是本机也没装 whisper。
  ipcMain.handle(CH.invoke.transcribe, async (_e, payload: TranscribeInput) => {
    if (!payload?.audio || !payload.audio.byteLength) {
      return { ok: false, error: '没有录到声音' }
    }

    const viaEndpoint = async (): Promise<TranscribeResult> => {
      const cfg = readModelConfig()
      if (!cfg.apiKey?.trim()) {
        return { ok: false, error: '还没有配置 API Key：云端识别要用你在「模型设置」里填写的端点' }
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
    }

    if (hasLocalWhisper()) {
      const local = await transcribeLocal(payload.audio, payload.mimeType)
      if (local.ok) return local
      const cloud = await viaEndpoint()
      return cloud.ok ? cloud : { ok: false, error: local.error + '；改用云端端点也没成功：' + cloud.error }
    }

    const cloud = await viaEndpoint()
    return cloud.ok
      ? cloud
      : { ok: false, error: cloud.error + '。本机也没有可用的 whisper.cpp，语音输入需要其中之一。' }
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

  ipcMain.handle(CH.invoke.listModels, async (_e, cfg: ModelConfigDto) => {
    return await listModels({
      apiKey: cfg.apiKey?.trim() || undefined,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      receiveTimeoutMs: cfg.receiveTimeoutMs ?? 45_000,
      reflectTimeoutMs: cfg.reflectTimeoutMs ?? 30_000,
    })
  })

  ipcMain.handle(CH.invoke.discuss, async (_e, payload: DiscussInput) => {
    const c = must()
    const s = c.memory.get(payload.sessionId)

    // 门禁**按模式判定**，不按通道：
    //   · challenge（认知挑战，会检验前提）——必须有同意记录。
    //   · receiving（只承接与澄清）——在定义上不构成认知挑战，因此不需要。
    // mode 省略时按 challenge 处理，这是安全默认：少写一个字段不会绕过门槛。
    //
    // ⚠️ 这**不是**放宽门槛。把整条 discuss 通道免同意才是放宽——那等于给
    //    「经过你同意才提问」开后门。承接模式免同意的唯一理由是它不问反问，
    //    而这一点由 buildDiscussMessages 里那段提示词保证，两处必须一起改。
    const mode = payload.mode ?? 'challenge'
    if (mode === 'challenge' && (!s || !canEnterReflection(s))) {
      return { ok: false, error: '这一轮推敲没有有效的同意记录，不能继续。请回到分流重新选择。' }
    }
    if (!c.model.available) {
      // ADR-0004：思考层不做内容兜底。
      // 这里原本有一段预写好的共情话术，流式播出、冒充成针对用户提问的回答，
      // 界面上完全看不出它是固定模板。评审问一句「这是模型刚生成的吗」就穿帮。
      return { ok: false, error: '模型未配置，这次没能生成。可以在右上角「模型设置」里配置后重试。' }
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      let fullReply = ''
      for await (const chunk of c.model.discuss(payload, controller.signal)) {
        fullReply += chunk
        send(CH.send.discussionDelta, {
          sessionId: payload.sessionId,
          thread: payload.thread,
          delta: chunk,
          done: false,
        })
      }
      clearTimeout(timer)
      send(CH.send.discussionDelta, {
        sessionId: payload.sessionId,
        thread: payload.thread,
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
