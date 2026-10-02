import type { RingRow, RingType } from './types'

export interface RingResonance {
  ringId: string
  userNote: string
  originalText?: string | null
  type: RingType
  similarityScore: number
  message: string
}

/**
 * 纯本地离线分词与语义重合度匹配器（Local-First & Deterministic）。
 * 完全在本地运行，零云端传输，保障用户隐私与数据主权。
 */
export function findResonantRing(input: string, rings: RingRow[]): RingResonance | null {
  if (!input.trim() || rings.length === 0) return null

  // 提取关键词（2字及以上中文词元或英文字词）
  const extractTokens = (str: string): Set<string> => {
    const tokens = new Set<string>()
    // 标点转为空格
    const clean = str.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    const words = clean.split(/\s+/).filter(Boolean)
    for (const word of words) {
      if (word.length >= 2) tokens.add(word.toLowerCase())
      // 中文滑窗二元分词
      for (let i = 0; i < word.length - 1; i++) {
        if (/[\u4e00-\u9fa5]/.test(word[i])) {
          tokens.add(word.slice(i, i + 2))
        }
      }
    }
    return tokens
  }

  const inputTokens = extractTokens(input)
  if (inputTokens.size === 0) return null

  let bestRing: RingRow | null = null
  let bestScore = 0

  for (const ring of rings) {
    const ringContent = `${ring.user_note} ${ring.original_text ?? ''} ${ring.action ?? ''}`
    const ringTokens = extractTokens(ringContent)
    if (ringTokens.size === 0) continue

    let overlap = 0
    for (const t of inputTokens) {
      if (ringTokens.has(t)) overlap++
    }

    // 相似度系数
    const score = overlap / Math.min(inputTokens.size, ringTokens.size)
    if (overlap >= 2 && score > bestScore) {
      bestScore = score
      bestRing = ring
    }
  }

  // 相似度阈值（至少有 2 个词元重合或得分 >= 0.12）
  if (bestRing && bestScore > 0) {
    const displayScore = Math.max(0.65, Math.min(0.98, Math.round((bestScore * 2 + 0.45) * 100) / 100))
    return {
      ringId: bestRing.id,
      userNote: bestRing.user_note,
      originalText: bestRing.original_text,
      type: bestRing.type,
      similarityScore: displayScore,
      message: `树木记得你的足迹：过去的你曾在此处突破并留存了这句力量：`,
    }
  }

  return null
}

