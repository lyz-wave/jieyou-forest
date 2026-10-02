import { useMemo } from 'react'
import type { RingRow } from '../../shared/types'
import { dueRings } from '../../shared/review'
import type { ReviewRow } from '../../shared/types'

/**
 * 「我的树」顶部的**事实**卡片。
 *
 * 这里原本叫「个人认知韧性图谱」，展示「微行动突破率」「最强韧性领域」
 * 「跨领域认知分布」，结尾还有一句结论式的表扬（"你不仅安放了情绪，更在真实
 * 生活里累积了应对困境的心智肌肉"）。那些全删了，三个理由：
 *
 * 1. **它在给用户打分。** PRD §3.2 的非目标里白纸黑字写着「不做认知成长评分」。
 *    而"突破率 67%"这种词，用户会开始为了分数而写——那正是 PRD 想避免的。
 * 2. **它算的东西配不上它的名字。** "突破率"实际只是"行动年轮占全部年轮的比例"；
 *    "最强韧性领域"是"哪个领域的关键词命中最多"。名字承诺了评估，代码做的是计数。
 * 3. **领域是正则猜的**，不是用户说的（见 TrunkRingsDisc 里那段说明）。
 *
 * 现在它只陈述可核对的事实：你有几圈、最早最晚是哪天、各自多少、
 * 有没有到该复盘还没复盘的。**这些数字不需要任何解释，用户自己会读懂。**
 */
export default function RingFacts({ rings, reviews }: { rings: RingRow[]; reviews: ReviewRow[] }) {
  const facts = useMemo(() => {
    if (rings.length === 0) return null
    const sorted = [...rings].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const actionCount = rings.filter((r) => r.type === 'action').length
    const supportCount = rings.length - actionCount
    const reviewed = new Set(reviews.map((r) => r.ring_id))
    return {
      actionCount,
      supportCount,
      first: sorted[0]?.created_at?.slice(0, 10) ?? '',
      last: sorted[sorted.length - 1]?.created_at?.slice(0, 10) ?? '',
      reviewedCount: rings.filter((r) => reviewed.has(r.id)).length,
      dueCount: dueRings(rings, reviews).length,
    }
  }, [rings, reviews])

  if (!facts) return null

  const cell = (label: string, value: string, hint?: string) => (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  )

  return (
    <div
      className="card"
      data-testid="ring-facts"
      style={{
        margin: '18px 0 22px',
        padding: '18px 20px',
        borderLeft: '4px solid #7d9a6a',
        background: 'rgba(255, 252, 246, 0.9)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em', marginBottom: 12 }}>
        🌳 你的年轮
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          background: 'rgba(255, 255, 255, 0.7)',
          padding: '14px 16px',
          borderRadius: 8,
        }}
      >
        {/* 总数不在这里重复——年轮盘的正中央已经写着它了。
            同一件事说两遍，用户会以为它们不是同一个数。 */}
        {cell('时间跨度', facts.first === facts.last ? facts.first : facts.first + ' 至 ' + facts.last)}
        {cell('其中', facts.actionCount + ' 圈行动 · ' + facts.supportCount + ' 圈陪伴')}
        {cell('已经复盘', facts.reviewedCount + ' 圈')}
        {facts.dueCount > 0 ? cell('到期未复盘', facts.dueCount + ' 圈') : cell('到期未复盘', '没有')}
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        这里只统计你自己留下的东西，不做评估。
      </p>
    </div>
  )
}
