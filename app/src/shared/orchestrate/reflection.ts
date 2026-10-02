import type { ModelClient } from '../model/client'

export interface ThreeViews {
  guardian: string
  explorer: string
  outsider: string
}

export type ReflectionOutcome =
  | {
      ok: true
      views: ThreeViews
      quotedInput: string[]
      assumptions: string[]
      reframedQuestion?: string
      socraticQuestions?: Partial<Record<'guardian' | 'explorer' | 'outsider' | 'mirror', string>>
      microExperiment?: { action: string; observableCriterion: string; estimatedMinutes?: number }
      promptVersion: string
    }
  | { ok: false; reason: 'no_consent' | 'timeout' | 'invalid' | 'unavailable' }

/** PRD F05 验收：所有用户原话引用必须逐字匹配输入。不匹配就整次丢弃。 */
export function quotedInputMatches(quotes: string[], input: string): boolean {
  return quotes.every((q) => q.trim().length > 0 && input.includes(q))
}

/**
 * 思考层。它不兜底（架构文档 §5）：拿不到就是未完成，绝不填示例稿。
 * 调用前必须已有 consentAt，这是 §1 的第一条不变量。
 */
export async function runReflection(deps: {
  model: ModelClient
  input: string
  consentAt?: string
  timeoutMs: number
}): Promise<ReflectionOutcome> {
  if (!deps.consentAt) return { ok: false, reason: 'no_consent' }
  if (!deps.model.available) return { ok: false, reason: 'unavailable' }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), deps.timeoutMs)
  try {
    const r = await deps.model.reflect(deps.input, ac.signal)
    clearTimeout(timer)
    if (!quotedInputMatches(r.quotedInput ?? [], deps.input)) return { ok: false, reason: 'invalid' }
    return {
      ok: true,
      views: r.views,
      quotedInput: r.quotedInput,
      assumptions: r.assumptions ?? [],
      reframedQuestion: r.reframedQuestion,
      socraticQuestions: r.socraticQuestions,
      microExperiment: r.microExperiment,
      promptVersion: r.promptVersion,
    }
  } catch {
    clearTimeout(timer)
    return { ok: false, reason: ac.signal.aborted ? 'timeout' : 'invalid' }
  }
}
