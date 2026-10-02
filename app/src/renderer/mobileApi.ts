import type {
  BannerResult,
  ConsentResult,
  CorrectResult,
  DeleteResult,
  EmptyResult,
  ErrorEvent,
  ForestApi,
  ReceiveChunk,
  ReflectionChunk,
  SaveRingInput,
  StateEvent,
  StatusResult,
  SubmitInput,
  SubmitResult,
  VerdictEvent,
} from '../shared/ipc'
import type { ReviewDraft, RingRow } from '../shared/types'
import { capabilitiesFor } from '../shared/capabilities'

const STORAGE_KEY = 'jieyou_rings_v1'

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

/**
 * 移动端/无 Electron 环境的纯本地适配器。
 * 允许在 iOS WKWebView / Capacitor / 独立浏览器中直接完整体验全部业务流程与年轮持久化。
 */
export function createMobileForestApi(): ForestApi {
  const receiveListeners = new Set<(p: ReceiveChunk) => void>()
  const reflectionListeners = new Set<(p: ReflectionChunk) => void>()
  const verdictListeners = new Set<(p: VerdictEvent) => void>()
  const stateListeners = new Set<(p: StateEvent) => void>()
  const errorListeners = new Set<(p: ErrorEvent) => void>()

  let rings: RingRow[] = loadSavedRings()
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

      return { sessionId, capabilities: caps, banner: null }
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
      return { ok: true }
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

    onReceive(cb): () => void {
      receiveListeners.add(cb)
      return () => receiveListeners.delete(cb)
    },
    onReflection(cb): () => void {
      reflectionListeners.add(cb)
      return () => reflectionListeners.delete(cb)
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
