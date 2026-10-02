// 领域类型。通道契约在 ./ipc.ts，不要在这里再定义一遍。

export type SafetyLevel = 'L1' | 'L2' | 'L3'
export type SessionPath = 'rest' | 'reflect'
export type SessionStatus =
  | 'draft' | 'receiving' | 'choosing' | 'resting' | 'reflecting' | 'optional_save' | 'ended'
export type RingType = 'support' | 'action'
export type RestCardId = 'leaf' | 'senses'
export type ReflectionCardId = 'guardian' | 'explorer' | 'outsider' | 'mirror'

/** 由安全级别推导出的能力。界面只能读它，不能自己判断。 */
export interface Capabilities {
  canRest: boolean
  canReflect: boolean
  canShowCrisis: boolean
}

export interface RingDraft {
  type: RingType
  userNote: string
  saveOriginal: boolean
  originalText?: string
  userDecision?: string
  action?: string
  criterion?: string
  reviewDue?: string
}

/** 一圈年轮的完整行，字段名与数据库列一一对应。 */
export interface RingRow {
  id: string
  session_id: string
  type: RingType
  user_note: string
  save_original: number
  original_text: string | null
  user_decision: string | null
  action: string | null
  criterion: string | null
  review_due: string | null
  created_at: string
  is_demo: number
  idempotency_key: string
}

/**
 * 复盘时对"那件小行动"的四选一。
 * 刻意不是"成功/失败"二元：情况变了、说不清，都是真实且常见的结局，
 * 二元会逼用户把这两类硬塞进"没做到"，那就成了评判。
 */
export type ReviewOutcome = 'done' | 'not_done' | 'changed' | 'unclear'

export interface ReviewDraft {
  outcome: ReviewOutcome
  /** 自由文字，可以为空——固定选项已经把成本压到最低了。 */
  observedResult: string
  premiseUpdate?: string
  nextStep?: string
}

/** 一条复盘记录。它和年轮里的原决定是并列关系，永不覆盖。 */
export interface ReviewRow {
  id: string
  ring_id: string
  outcome: ReviewOutcome | null
  observed_result: string | null
  premise_update: string | null
  next_step: string | null
  created_at: string
}
