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

export interface ReviewDraft {
  executed: boolean
  observedResult: string
  premiseUpdate?: string
  nextStep?: string
}
