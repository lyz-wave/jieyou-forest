import type { SafetyLevel } from '../../shared/types'

// 能力映射住在 shared（渲染进程也要用同一份），这里只把它转出去。
export { capabilitiesFor } from '../../shared/capabilities'

export interface GateRule {
  id: string
  patterns: string[]
}
export interface RulesFile {
  version: string
  l1: GateRule[]
  l2: GateRule[]
  contextExclusions: string[]
}

export interface GateInput {
  text: string
  /** 模型的可选判定。它只能把 L3 抬到 L2，既不能产出 L1，也不能压低任何已有判定。 */
  modelVerdict?: 'L2' | null
}

export interface GateResult {
  level: SafetyLevel
  /** 命中的规则 id，用于回归与复盘；不含用户原文 */
  hits: string[]
  /** 只记机器可读的原因码，永不记正文 */
  reasonCode: 'l1_hit' | 'l2_hit' | 'context_excluded' | 'model_escalated' | 'no_signal' | 'corrected'
  corrected: boolean
}

/**
 * 判定顺序（架构文档 §4）：
 *   1. 关键词独立工作，不依赖模型是否存在
 *   2. 上下文排除只把 L1 降到 L2，不降到 L3——保守的含义是不辩论，不是当作没看见
 *   3. 模型只能把 L3 抬到 L2
 */
export function evaluateGate(input: GateInput, rules: RulesFile): GateResult {
  const text = input.text
  const l1hits = rules.l1.filter((r) => r.patterns.some((p) => text.includes(p)))
  const l2hits = rules.l2.filter((r) => r.patterns.some((p) => text.includes(p)))

  if (l1hits.length > 0) {
    const excluded = rules.contextExclusions.some((p) => text.includes(p))
    if (excluded) {
      return { level: 'L2', hits: [...l1hits, ...l2hits].map((r) => r.id), reasonCode: 'context_excluded', corrected: false }
    }
    return { level: 'L1', hits: l1hits.map((r) => r.id), reasonCode: 'l1_hit', corrected: false }
  }

  if (l2hits.length > 0) {
    return { level: 'L2', hits: l2hits.map((r) => r.id), reasonCode: 'l2_hit', corrected: false }
  }

  if (input.modelVerdict === 'L2') {
    return { level: 'L2', hits: [], reasonCode: 'model_escalated', corrected: false }
  }

  return { level: 'L3', hits: [], reasonCode: 'no_signal', corrected: false }
}

/** 用户声明「我说的不是这个意思」。只降一级，且永不到 L3、永不解锁思考。 */
export function applyCorrection(result: GateResult): GateResult {
  return {
    level: result.level === 'L1' ? 'L2' : result.level,
    hits: result.hits,
    reasonCode: 'corrected',
    corrected: true,
  }
}
