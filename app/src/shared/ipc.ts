import type {
  Capabilities, ReflectionCardId, ReviewDraft, RingDraft, RingRow, SafetyLevel, SessionPath, SessionStatus,
} from './types'

/**
 * 主进程与渲染进程之间的唯一契约。
 *
 * 通道名只在这里写一次：preload 与 main/ipc.ts 都引用 CH，
 * 任何一侧漏改都会在类型检查阶段报错，而不是等到运行时才发现通道不存在。
 */
export const CH = {
  invoke: {
    submit: 'session:submit',
    retryReceive: 'session:retryReceive',
    correct: 'safety:correct',
    choosePath: 'path:choose',
    consent: 'reflect:consent',
    cancelReflect: 'reflect:cancel',
    saveRing: 'ring:save',
    listRings: 'ring:list',
    getRing: 'ring:get',
    deleteRing: 'ring:delete',
    saveReview: 'review:save',
    clearAll: 'data:clearAll',
    demoReset: 'demo:reset',
    getModelConfig: 'config:getModel',
    saveModelConfig: 'config:saveModel',
    testModelConfig: 'config:testModel',
    listModels: 'config:listModels',
    transcribe: 'voice:transcribe',
    discuss: 'reflect:discuss',
  },
  send: {
    receive: 'stream:receive',
    reflection: 'stream:reflection',
    discussionDelta: 'stream:discussionDelta',
    verdict: 'safety:verdict',
    state: 'state:changed',
    error: 'stage:error',
  },
} as const


/** 通道字符串的联合类型。两侧的发送/订阅形参都用它，
 *  这样写裸字面量（而不是引用 CH）会直接编译不过。 */
export type InvokeChannel = (typeof CH.invoke)[keyof typeof CH.invoke]
export type SendChannel = (typeof CH.send)[keyof typeof CH.send]

import type { RingResonance } from './resonance'
export type { RingResonance } from './resonance'

export interface SubmitInput {
  input: string
}
export interface SubmitResult {
  sessionId: string
  capabilities: Capabilities
  banner: string | null
  resonance?: RingResonance | null
}

export interface CorrectResult {
  level: SafetyLevel
  capabilities: Capabilities
}
export interface MicroExperiment {
  action: string
  observableCriterion: string
  estimatedMinutes?: number
}

export interface CognitiveAnalysis {
  /** 逐字引用自用户输入的原话。可核对，不是推断。 */
  quotedInput: string[]
  /** 折返镜读到的前提。属模型推断，界面必须标注为推断。 */
  assumptions: string[]
  /** 折返镜提出的替代问题。 */
  reframedQuestion: string
  /** 各视角的反问。由模型生成；生成不出来就缺席，不塞通用话术。 */
  socraticQuestions?: Partial<Record<ReflectionCardId, string>>
  /** 微行动建议。是建议不是处方，用户可以不采纳。模型没给就缺席。 */
  microExperiment?: MicroExperiment
  promptVersion: string
}

export interface ConsentResult {
  ok: boolean
  reason?: string
  analysis?: CognitiveAnalysis
}
export interface StatusResult {
  status: SessionStatus
}
export interface BannerResult {
  banner: string | null
}
export interface DeleteResult {
  deleted: boolean
  stillReadable: boolean
}
export interface EmptyResult {
  empty: boolean
}
export interface SaveRingInput {
  sessionId: string
  idempotencyKey: string
  draft: RingDraft
}

export interface ModelConfigDto {
  apiKey?: string
  baseUrl: string
  model: string
  /** 语音转文字的模型。留空则按 baseUrl 推断（shared/asr.ts: defaultAsrModel）。 */
  asrModel?: string
  receiveTimeoutMs?: number
  reflectTimeoutMs?: number
}

export interface TranscribeInput {
  /** 录音字节。走结构化克隆，不是 base64，避免大段字符串在 IPC 上翻倍。 */
  audio: Uint8Array
  /** 录音的 MIME 类型，决定文件名后缀 */
  mimeType: string
}

export interface TranscribeResult {
  ok: boolean
  text?: string
  error?: string
}

export interface TestModelResult {
  ok: boolean
  message?: string
  error?: string
  latencyMs?: number
}

export interface ListModelsResult {
  ok: boolean
  /** 服务端返回的可用模型 id 列表。失败时为空数组，原因在 error 里。 */
  models: string[]
  error?: string
}

export interface DiscussMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 推敲的两种模式。
 *
 * challenge：认知挑战——会检验用户的前提假设。**必须有同意记录**（PRD 第一条不变量）。
 * receiving：只承接与澄清——不提问反问、不检验前提，在定义上不构成认知挑战，因此不需要同意。
 */
export type DiscussMode = 'challenge' | 'receiving'

/** 会话线程标识。认知挑战用视角 id；承接模式用 'receiving'。 */
export type DiscussThread = ReflectionCardId | 'receiving'

export interface DiscussInput {
  sessionId: string
  /** 线程键。渲染层按它过滤流式分片，所以它必须唯一标识一条对话。 */
  thread: DiscussThread
  /** 线程的显示名，用于界面标题与保存顿悟时的前缀。 */
  threadTitle: string
  userQuery: string
  history?: DiscussMessage[]
  /** 省略时按 'challenge' 处理——**安全默认**：少写一个字段不会绕过同意门槛。 */
  mode?: DiscussMode
}

export interface DiscussResult {
  ok: boolean
  reply?: string
  error?: string
}

export interface DiscussionChunk {
  sessionId: string
  thread: DiscussThread
  delta: string
  done: boolean
}

export interface ReceiveChunk {
  sessionId: string
  delta: string
  done: boolean
}
export interface ReflectionChunk {
  sessionId: string
  card: ReflectionCardId
  delta: string
  done: boolean
}
export interface VerdictEvent {
  sessionId: string
  level: SafetyLevel
}
export interface StateEvent {
  sessionId: string
  status: SessionStatus
}
export interface ErrorEvent {
  sessionId: string
  stage: string
  code: string
}

/** 渲染进程能看到的全部能力。preload 必须完整实现它，缺一个方法就编译不过。 */
export interface ForestApi {
  submit(p: SubmitInput): Promise<SubmitResult>
  retryReceive(p: { sessionId: string }): Promise<BannerResult>
  correct(p: { sessionId: string }): Promise<CorrectResult>
  choosePath(p: { sessionId: string; path: SessionPath }): Promise<StatusResult>
  consent(p: { sessionId: string }): Promise<ConsentResult>
  cancelReflect(p: { sessionId: string }): Promise<StatusResult>
  saveRing(p: SaveRingInput): Promise<{ ringId: string }>
  listRings(): Promise<RingRow[]>
  getRing(p: { id: string }): Promise<RingRow | undefined>
  deleteRing(p: { id: string }): Promise<DeleteResult>
  saveReview(p: { ringId: string; draft: ReviewDraft }): Promise<{ reviewId: string }>
  clearAll(): Promise<EmptyResult>
  demoReset(): Promise<EmptyResult>
  getModelConfig(): Promise<ModelConfigDto>
  saveModelConfig(cfg: ModelConfigDto): Promise<{ ok: boolean }>
  testModelConfig(cfg: ModelConfigDto): Promise<TestModelResult>
  listModels(cfg: ModelConfigDto): Promise<ListModelsResult>
  transcribe(p: TranscribeInput): Promise<TranscribeResult>
  discuss(p: DiscussInput): Promise<DiscussResult>

  onReceive(cb: (p: ReceiveChunk) => void): () => void
  onReflection(cb: (p: ReflectionChunk) => void): () => void
  onDiscussionDelta(cb: (p: DiscussionChunk) => void): () => void
  onVerdict(cb: (p: VerdictEvent) => void): () => void
  onState(cb: (p: StateEvent) => void): () => void
  onError(cb: (p: ErrorEvent) => void): () => void
}

