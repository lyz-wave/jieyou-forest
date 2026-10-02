import type {
  BannerResult,
  CognitiveAnalysis,
  ListModelsResult,
  ConsentResult,
  CorrectResult,
  DeleteResult,
  DiscussionChunk,
  DiscussInput,
  DiscussResult,
  EmptyResult,
  ErrorEvent,
  ForestApi,
  ModelConfigDto,
  ReceiveChunk,
  ReflectionChunk,
  SaveRingInput,
  StateEvent,
  StatusResult,
  SubmitInput,
  SubmitResult,
  TestModelResult,
  VerdictEvent,
} from '../shared/ipc'
import type { ReviewDraft, RingRow } from '../shared/types'
import { capabilitiesFor } from '../shared/capabilities'
import { findResonantRing } from '../shared/resonance'
import rules from '../shared/gate/rules.json'
import { applyCorrection, evaluateGate, type GateResult, type RulesFile } from '../shared/gate/gate'
import { createModelClient, listModels } from '../shared/model/client'
import { runReceive } from '../shared/orchestrate/receive'
import { runReflection } from '../shared/orchestrate/reflection'

const RULES = rules as RulesFile

const STORAGE_KEY = 'jieyou_rings_v1'
const CONFIG_KEY = 'jieyou_model_config_v1'

function loadSavedRings(): RingRow[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    }
  } catch {}
  return []
}

function saveRingsToStorage(rings: RingRow[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rings))
    }
  } catch {}
}

function loadSavedConfig(): ModelConfigDto {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CONFIG_KEY)
      if (raw) return JSON.parse(raw)
    }
  } catch {}
  return {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: '',
  }
}

function saveConfigToStorage(cfg: ModelConfigDto): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
    }
  } catch {}
}

function clientFromConfig(cfg: ModelConfigDto) {
  return createModelClient({
    apiKey: cfg.apiKey?.trim() || undefined,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    receiveTimeoutMs: cfg.receiveTimeoutMs ?? 45_000,
    reflectTimeoutMs: cfg.reflectTimeoutMs ?? 30_000,
  })
}

/**
 * 移动端 / 无 Electron 环境的适配器（Capacitor / iOS WKWebView / 独立浏览器）。
 *
 * 它与主进程共用 shared/ 下的同一套东西：安全闸门、承接与三视角的编排、
 * 模型客户端、兜底稿。契约的形状由 shared/ipc.ts 保证，行为由这些共享模块保证——
 * 两边不会再各写一份。
 */
export function createMobileForestApi(): ForestApi {
  const receiveListeners = new Set<(p: ReceiveChunk) => void>()
  const reflectionListeners = new Set<(p: ReflectionChunk) => void>()
  const discussionListeners = new Set<(p: DiscussionChunk) => void>()
  const verdictListeners = new Set<(p: VerdictEvent) => void>()
  const stateListeners = new Set<(p: StateEvent) => void>()
  const errorListeners = new Set<(p: ErrorEvent) => void>()

  let rings: RingRow[] = loadSavedRings()
  let modelConfig: ModelConfigDto = loadSavedConfig()
  let currentInput = ''
  /** 当前会话的安全判定。L1/L2/L3 由真实的闸门给出，不再写死。 */
  let currentGate: GateResult | null = null
  /** 同意记录。与桌面端同一条不变量：没有它就没有认知挑战。 */
  let currentConsentAt: string | undefined

  const caps = (): ReturnType<typeof capabilitiesFor> =>
    capabilitiesFor(currentGate?.level ?? 'L3')

  return {
    async submit(p: SubmitInput): Promise<SubmitResult> {
      const sessionId = 's_' + Date.now().toString(36)
      currentInput = p.input
      currentConsentAt = undefined

      // 与桌面端共用同一道闸门。
      // 这里原本写死 level = 'L3'——也就是说 iOS 上根本不做任何安全判定，
      // 用户写下明确危险表达，照样会收到「先慢慢深呼吸」的舒缓回应。
      const gate = evaluateGate({ text: p.input }, RULES)
      currentGate = gate

      verdictListeners.forEach((cb) => cb({ sessionId, level: gate.level }))
      stateListeners.forEach((cb) => cb({ sessionId, status: 'receiving' }))

      // L1 不生树、不出休息卡、不思考，也不把这段话发去调模型
      if (gate.level === 'L1') {
        return { sessionId, capabilities: capabilitiesFor(gate.level), banner: null }
      }

      const outcome = await runReceive({
        model: clientFromConfig(modelConfig),
        input: p.input,
        timeoutMs: modelConfig.receiveTimeoutMs ?? 45_000,
        emit: (delta, done) => receiveListeners.forEach((cb) => cb({ sessionId, delta, done })),
      })
      stateListeners.forEach((cb) => cb({ sessionId, status: 'choosing' }))

      // 承接失败时走的是带标识的内置示例稿，界面上会同时显示横幅——
      // 不再是那句对谁都一样的「被这样对待，确实可能让人难受」。
      return {
        sessionId,
        capabilities: capabilitiesFor(gate.level),
        banner: outcome.banner ?? null,
        resonance: findResonantRing(p.input, rings),
      }
    },

    async retryReceive({ sessionId }): Promise<BannerResult> {
      const outcome = await runReceive({
        model: clientFromConfig(modelConfig),
        input: currentInput,
        timeoutMs: modelConfig.receiveTimeoutMs ?? 45_000,
        emit: (delta, done) => receiveListeners.forEach((cb) => cb({ sessionId, delta, done })),
      })
      return { banner: outcome.banner ?? null }
    },

    async correct(): Promise<CorrectResult> {
      // 更正只恢复休息路径，永不解锁思考——与桌面端同一套语义。
      currentGate = applyCorrection(currentGate ?? evaluateGate({ text: '' }, RULES))
      currentConsentAt = undefined
      return { level: currentGate.level, capabilities: capabilitiesFor(currentGate.level) }
    },

    async choosePath({ sessionId, path }): Promise<StatusResult> {
      const c = caps()
      if (path === 'reflect' && !c.canReflect) {
        throw new Error('当前状态不提供思考路径')
      }
      if (!c.canRest) {
        throw new Error('当前状态不提供休息路径')
      }
      const status = path === 'rest' ? 'resting' : 'reflecting'
      stateListeners.forEach((cb) => cb({ sessionId, status }))
      return { status }
    },

    async consent({ sessionId }): Promise<ConsentResult> {
      // 同意门槛：没有它就不产生任何认知挑战
      if (!caps().canReflect) {
        return { ok: false, reason: 'no_consent' }
      }
      currentConsentAt = new Date().toISOString()

      const outcome = await runReflection({
        model: clientFromConfig(modelConfig),
        input: currentInput,
        consentAt: currentConsentAt,
        timeoutMs: modelConfig.reflectTimeoutMs ?? 30_000,
      })

      // 思考层不做内容兜底：拿不到就是未完成，界面上如实显示。
      // 这里原本返回三段硬编码的「视角」和一份伪造分析，
      // 其中还替用户编造了没说过的话（「他们全盘否定我，我彻底搞砸了」）。
      if (!outcome.ok) return { ok: false, reason: outcome.reason }

      const emitCard = (card: ReflectionChunk['card'], text: string): void =>
        reflectionListeners.forEach((cb) => cb({ sessionId, card, delta: text, done: true }))
      emitCard('guardian', outcome.views.guardian)
      emitCard('explorer', outcome.views.explorer)
      emitCard('outsider', outcome.views.outsider)
      emitCard('mirror', outcome.reframedQuestion ?? '')

      const analysis: CognitiveAnalysis = {
        quotedInput: (outcome.quotedInput ?? []).filter((q) => typeof q === 'string' && q.trim().length > 0),
        assumptions: outcome.assumptions ?? [],
        reframedQuestion: outcome.reframedQuestion ?? '',
        socraticQuestions: outcome.socraticQuestions,
        microExperiment: outcome.microExperiment,
        promptVersion: outcome.promptVersion,
      }
      return { ok: true, analysis }
    },

    async cancelReflect({ sessionId }): Promise<StatusResult> {
      stateListeners.forEach((cb) => cb({ sessionId, status: 'choosing' }))
      return { status: 'choosing' }
    },

    async saveRing({ sessionId, draft, idempotencyKey }: SaveRingInput): Promise<{ ringId: string }> {
      const existing = rings.find((r) => r.id === idempotencyKey)
      if (existing) return { ringId: idempotencyKey }

      const newRing: RingRow = {
        id: idempotencyKey,
        session_id: sessionId,
        type: draft.type,
        user_note: draft.userNote,
        save_original: draft.saveOriginal ? 1 : 0,
        original_text: draft.saveOriginal ? (draft.originalText ?? currentInput) : null,
        user_decision: draft.userDecision ?? null,
        action: draft.action ?? null,
        criterion: draft.criterion ?? null,
        review_due: draft.reviewDue ?? null,
        created_at: new Date().toISOString(),
        is_demo: 0,
        idempotency_key: idempotencyKey,
      }
      rings = [newRing, ...rings]
      saveRingsToStorage(rings)
      return { ringId: idempotencyKey }
    },

    async listRings(): Promise<RingRow[]> {
      return [...rings]
    },

    async getRing({ id }): Promise<RingRow | undefined> {
      return rings.find((r) => r.id === id)
    },

    async deleteRing({ id }): Promise<DeleteResult> {
      const before = rings.length
      rings = rings.filter((r) => r.id !== id)
      saveRingsToStorage(rings)
      return { deleted: rings.length < before, stillReadable: false }
    },

    async saveReview(_p: { ringId: string; draft: ReviewDraft }): Promise<{ reviewId: string }> {
      return { reviewId: 'rev_' + Date.now().toString(36) }
    },

    async clearAll(): Promise<EmptyResult> {
      rings = []
      saveRingsToStorage(rings)
      return { empty: true }
    },

    async demoReset(): Promise<EmptyResult> {
      rings = []
      saveRingsToStorage(rings)
      return { empty: true }
    },

    async listModels(cfg: ModelConfigDto): Promise<ListModelsResult> {
      // 与桌面端共用同一个实现：同一个地址归一化、同一套返回解析
      return listModels({
        apiKey: cfg.apiKey?.trim() || undefined,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        receiveTimeoutMs: cfg.receiveTimeoutMs ?? 45_000,
        reflectTimeoutMs: cfg.reflectTimeoutMs ?? 30_000,
      })
    },

    async getModelConfig(): Promise<ModelConfigDto> {
      return { ...modelConfig }
    },

    async saveModelConfig(cfg: ModelConfigDto): Promise<{ ok: boolean }> {
      modelConfig = { ...cfg }
      saveConfigToStorage(modelConfig)
      return { ok: true }
    },

    async testModelConfig(cfg: ModelConfigDto): Promise<TestModelResult> {
      if (!cfg.apiKey?.trim()) {
        return { ok: false, error: '请先填写 API Key' }
      }
      const cleanUrl = cfg.baseUrl.trim().replace(/\/+$/, '')
      const url = cleanUrl.endsWith('/chat/completions')
        ? cleanUrl
        : cleanUrl.endsWith('/v1')
          ? cleanUrl + '/chat/completions'
          : cleanUrl + '/v1/chat/completions'
      const start = Date.now()
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12_000)
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + cfg.apiKey.trim(),
          },
          body: JSON.stringify({
            model: cfg.model.trim() || 'deepseek-chat',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
          }),
          signal: controller.signal,
        })
        clearTimeout(timer)
        const latencyMs = Date.now() - start
        if (!res.ok) return { ok: false, latencyMs, error: 'HTTP ' + res.status + ': ' + res.statusText }
        return { ok: true, latencyMs, message: '连接成功，延迟 ' + latencyMs + 'ms' }
      } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message || '网络连接失败' }
      }
    },

    async discuss(p: DiscussInput): Promise<DiscussResult> {
      // 与三视角同一道门禁：没有同意记录，就没有认知挑战。
      if (!currentConsentAt || !caps().canReflect) {
        return { ok: false, error: '这一轮推敲没有有效的同意记录，不能继续。请回到分流重新选择。' }
      }
      const client = clientFromConfig(modelConfig)
      if (!client.available) {
        // ADR-0004：思考层不做内容兜底。
        // 这里原本在失败或没配 key 时流出一段预写好的共情话术，冒充成回答。
        return { ok: false, error: '模型未配置，这次没能生成。可以在设置里配置模型后重试。' }
      }
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 30_000)
      try {
        let full = ''
        for await (const chunk of client.discuss(p, ac.signal)) {
          full += chunk
          discussionListeners.forEach((cb) =>
            cb({ sessionId: p.sessionId, perspective: p.perspective, delta: chunk, done: false }),
          )
        }
        clearTimeout(timer)
        discussionListeners.forEach((cb) =>
          cb({ sessionId: p.sessionId, perspective: p.perspective, delta: '', done: true }),
        )
        return { ok: true, reply: full }
      } catch (err) {
        clearTimeout(timer)
        return { ok: false, error: (err as Error).message || '讨论生成遇到问题' }
      }
    },

    onReceive(cb): () => void {
      receiveListeners.add(cb)
      return () => receiveListeners.delete(cb)
    },
    onReflection(cb): () => void {
      reflectionListeners.add(cb)
      return () => reflectionListeners.delete(cb)
    },
    onDiscussionDelta(cb): () => void {
      discussionListeners.add(cb)
      return () => discussionListeners.delete(cb)
    },
    onVerdict(cb): () => void {
      verdictListeners.add(cb)
      return () => verdictListeners.delete(cb)
    },
    onState(cb): () => void {
      stateListeners.add(cb)
      return () => stateListeners.delete(cb)
    },
    onError(cb): () => void {
      errorListeners.add(cb)
      return () => errorListeners.delete(cb)
    },
  }
}
