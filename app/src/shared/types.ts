// 主进程与渲染进程共用的类型。对应架构文档 §2 的 IPC 契约。

export type SafetyLevel = 'L1' | 'L2' | 'L3'
export type SessionPath = 'rest' | 'reflect'
export type SessionStatus =
  | 'draft' | 'receiving' | 'choosing' | 'resting' | 'reflecting' | 'optional_save' | 'ended'
export type RingType = 'support' | 'action'
export type RestCardId = 'leaf' | 'senses'
export type ReflectionCardId = 'guardian' | 'explorer' | 'outsider' | 'mirror'

/** 由安全级别推导出的能力，界面只能读它，不能自己判断 */
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

export interface ReviewDraft {
  executed: boolean
  observedResult: string
  premiseUpdate?: string
  nextStep?: string
}

export interface SubmitInput {
  input: string
  emotion?: string
  intensity?: string
}

export const ipcChannels = {
  invoke: [
    'session:submit', 'session:retryReceive', 'safety:correct', 'path:choose',
    'reflect:consent', 'reflect:cancel', 'reflect:retry', 'ring:save',
    'ring:list', 'ring:get', 'ring:delete', 'review:save', 'data:clearAll', 'demo:reset',
  ],
  send: ['stream:receive', 'stream:reflection', 'safety:verdict', 'state:changed', 'stage:error'],
} as const
