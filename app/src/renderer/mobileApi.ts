import type {
  BannerResult,
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
  TranscribeInput,
  TranscribeResult,
  VerdictEvent,
} from '../shared/ipc'
import type { ReviewDraft, RingRow } from '../shared/types'
import { capabilitiesFor } from '../shared/capabilities'
import { findResonantRing } from '../shared/resonance'
import { transcribeAudio } from '../shared/asr'

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

/**
 * 移动端/无 Electron 环境的纯本地适配器。
 * 允许在 iOS WKWebView / Capacitor / 独立浏览器中直接完整体验全部业务流程与年轮持久化。
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

  return {
    async submit(p: SubmitInput): Promise<SubmitResult> {
      const sessionId = 's_' + Date.now().toString(36)
      currentInput = p.input
      const level = 'L3'
      const caps = capabilitiesFor(level)

      verdictListeners.forEach((cb) => cb({ sessionId, level }))
      stateListeners.forEach((cb) => cb({ sessionId, status: 'receiving' }))

      setTimeout(() => {
        const reply = '被这样对待，确实可能让人难受。先慢慢深呼吸，这里没有评判，只有微风与落叶。'
        receiveListeners.forEach((cb) => cb({ sessionId, delta: reply, done: true }))
        stateListeners.forEach((cb) => cb({ sessionId, status: 'choosing' }))
      }, 350)

      const resonance = findResonantRing(p.input, rings)
      return { sessionId, capabilities: caps, banner: null, resonance }
    },

    async retryReceive(): Promise<BannerResult> {
      return { banner: '这是内置的轻柔陪伴提示，山林一直在倾听你的心声。' }
    },

    async correct(): Promise<CorrectResult> {
      const level = 'L2'
      return { level, capabilities: { canRest: true, canReflect: false, canShowCrisis: false } }
    },

    async choosePath({ sessionId, path }): Promise<StatusResult> {
      const status = path === 'rest' ? 'resting' : 'reflecting'
      stateListeners.forEach((cb) => cb({ sessionId, status }))
      return { status }
    },

    async consent({ sessionId }): Promise<ConsentResult> {
      setTimeout(() => {
        reflectionListeners.forEach((cb) =>
          cb({ sessionId, card: 'guardian', delta: '守护者视角：你已经在竭尽全力应对眼前的挑战，允许自己停下来片刻。', done: true }),
        )
        reflectionListeners.forEach((cb) =>
          cb({ sessionId, card: 'explorer', delta: '探索者视角：如果这件事是一块路标，它最想提醒你珍惜什么？', done: true }),
        )
        reflectionListeners.forEach((cb) =>
          cb({ sessionId, card: 'outsider', delta: '旁观者视角：一年后的自己再回头看现在的纠结，可能会微笑并感谢现在的勇敢。', done: true }),
        )
        reflectionListeners.forEach((cb) =>
          cb({ sessionId, card: 'mirror', delta: '重构之镜：有没有可能，这并不是你的失败，而是一个重新定义边界的契机？', done: true }),
        )
      }, 350)
      return {
        ok: true,
        analysis: {
          objectiveFact: currentInput || '今天收到了一条令自己受挫的反馈',
          subjectiveAssumption: '他们全盘否定我，我彻底搞砸了',
          distortionBadge: '灾难化',
          socraticQuestions: {
            guardian: '守护者反问：你最想守护的核心边界和个人底线是什么？',
            explorer: '探索者反问：如果把反对意见当作路标，这里藏着什么新可能？',
            outsider: '局外人反问：一年后的你回看今天，会怎么看待这个小插曲？',
          },
          microExperiment: {
            action: '明天只找关键人核实第一个修改点',
            observableCriterion: '得到明确边界结论并记录在笔记中',
            estimatedMinutes: 5,
          },
        },
      }
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
        const timer = setTimeout(() => controller.abort(), 12000)
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
        if (!res.ok) {
          return { ok: false, latencyMs, error: `HTTP ${res.status}: ${res.statusText}` }
        }
        return { ok: true, latencyMs, message: `连接成功，延迟 ${latencyMs}ms` }
      } catch (err: any) {
        return { ok: false, latencyMs: Date.now() - start, error: err.message || '网络连接失败' }
      }
    },

    // 移动端/浏览器形态没有主进程，直接在渲染层调同一个 shared/asr.ts。
    async transcribe(p: TranscribeInput): Promise<TranscribeResult> {
      if (!p?.audio || !p.audio.byteLength) {
        return { ok: false, error: '没有录到声音' }
      }
      if (!modelConfig.apiKey?.trim()) {
        return { ok: false, error: '还没有配置 API Key：语音识别要走你在「模型设置」里填写的端点' }
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 60_000)
      try {
        const text = await transcribeAudio({
          audio: new Uint8Array(p.audio),
          mimeType: p.mimeType,
          config: { baseUrl: modelConfig.baseUrl, apiKey: modelConfig.apiKey, model: modelConfig.asrModel },
          signal: controller.signal,
        })
        return { ok: true, text }
      } catch (err: any) {
        const msg = err?.name === 'AbortError' ? '识别超时（60 秒）' : err?.message || '语音识别失败'
        return { ok: false, error: msg }
      } finally {
        clearTimeout(timer)
      }
    },

    async discuss(p: DiscussInput): Promise<DiscussResult> {
      const fallbackReplies: Record<string, string> = {
        guardian: '我注意到你的疲惫与认真。你已经在承担很多了。如果现在允许自己放下 10% 的自责，你最想先给自己的边界留出什么空间？',
        explorer: '如果把这次的阻碍视作一个提示信号而非判决，你觉得它最想引导你发现哪种新的应对方式？哪怕只是一个小试验？',
        outsider: '跳出眼前的焦虑，设想一年后的你坐在安静的书房里回望今天，你最想对现在的自己说一句什么鼓励的话？',
        mirror: '当我们感到失控时，往往把“最坏的猜想”误认成了“必然的现实”。试问：眼前切实发生的事实，与你担心的未来，边界在哪里？',
      }
      const fallbackReply = fallbackReplies[p.perspective] || '深呼吸，给自己的内心留一扇窗。你现在最需要的一份安心是什么？'

      if (!modelConfig.apiKey?.trim()) {
        setTimeout(() => {
          discussionListeners.forEach((cb) =>
            cb({
              sessionId: p.sessionId,
              perspective: p.perspective,
              delta: fallbackReply,
              done: true,
            }),
          )
        }, 300)
        return { ok: true, reply: fallbackReply }
      }

      try {
        const cleanUrl = modelConfig.baseUrl.trim().replace(/\/+$/, '')
        const url = cleanUrl.endsWith('/chat/completions')
          ? cleanUrl
          : cleanUrl.endsWith('/v1')
            ? cleanUrl + '/chat/completions'
            : cleanUrl + '/v1/chat/completions'
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + modelConfig.apiKey.trim(),
          },
          body: JSON.stringify({
            model: modelConfig.model.trim() || 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: `你正在以【${p.perspectiveTitle}】视角与用户展开苏格拉底式深入探讨。言简意赅控制在120字内，提出一个启发性的反问，促使自我觉察与行动，避免情绪反刍。`,
              },
              ...(p.history || []),
              { role: 'user', content: p.userQuery },
            ],
          }),
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || fallbackReply
        discussionListeners.forEach((cb) =>
          cb({
            sessionId: p.sessionId,
            perspective: p.perspective,
            delta: content,
            done: true,
          }),
        )
        return { ok: true, reply: content }
      } catch {
        setTimeout(() => {
          discussionListeners.forEach((cb) =>
            cb({
              sessionId: p.sessionId,
              perspective: p.perspective,
              delta: fallbackReply,
              done: true,
            }),
          )
        }, 200)
        return { ok: true, reply: fallbackReply }
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
