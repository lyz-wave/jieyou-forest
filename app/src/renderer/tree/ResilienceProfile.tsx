import { useMemo } from 'react'
import type { RingRow } from '../../shared/types'
import {
  DOMAIN_CATEGORIES,
  DomainCategory,
  inferRingDomain,
  inferRingEmotion,
  EMOTION_THEMES,
} from './TrunkRingsDisc'

interface ResilienceProfileProps {
  rings: RingRow[]
}

export default function ResilienceProfile({ rings }: ResilienceProfileProps) {
  const stats = useMemo(() => {
    const total = rings.length
    if (total === 0) return null

    const actionCount = rings.filter((r) => r.type === 'action').length
    const supportCount = rings.filter((r) => r.type === 'support').length
    const actionRate = Math.round((actionCount / total) * 100)

    const domainCounts: Record<DomainCategory, number> = {
      all: total,
      work: 0,
      relationship: 0,
      self: 0,
      creative: 0,
    }

    const emotionCounts: Record<string, number> = {}

    rings.forEach((r) => {
      const d = inferRingDomain(r)
      domainCounts[d] = (domainCounts[d] || 0) + 1

      const emo = inferRingEmotion(r)
      emotionCounts[emo] = (emotionCounts[emo] || 0) + 1
    })

    // 找出最经常转化的情绪基调
    let topEmotion = 'default'
    let topEmotionCount = 0
    Object.entries(emotionCounts).forEach(([emo, count]) => {
      if (count > topEmotionCount) {
        topEmotion = emo
        topEmotionCount = count
      }
    })

    // 找出最多记录的领域
    let topDomain: DomainCategory = 'self'
    let topDomainCount = 0
    ;(Object.keys(domainCounts) as DomainCategory[]).forEach((d) => {
      if (d !== 'all' && domainCounts[d] > topDomainCount) {
        topDomain = d
        topDomainCount = domainCounts[d]
      }
    })

    return {
      total,
      actionCount,
      supportCount,
      actionRate,
      domainCounts,
      topEmotionLabel: EMOTION_THEMES[topEmotion as keyof typeof EMOTION_THEMES]?.label ?? '温润原木',
      topDomainLabel: DOMAIN_CATEGORIES.find((c) => c.id === topDomain)?.label ?? '自我认同',
    }
  }, [rings])

  if (!stats) return null

  return (
    <div
      className="card resilience-profile-card"
      data-testid="resilience-profile"
      style={{
        margin: '18px 0 22px',
        padding: '18px 20px',
        borderLeft: '4px solid #4b7b5e',
        background: 'rgba(246, 250, 246, 0.93)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🛡️</span>
          <strong style={{ fontSize: 14, color: '#2d4b32', letterSpacing: '0.02em' }}>
            个人认知韧性图谱
          </strong>
        </div>
        <span className="chip" style={{ fontSize: 11, background: 'rgba(75, 123, 94, 0.15)', color: '#2d4b32' }}>
          沉淀心智资产
        </span>
      </div>

      {/* 核心指标统计横幅 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          background: 'rgba(255, 255, 255, 0.75)',
          padding: '12px 14px',
          borderRadius: 8,
          marginBottom: 14,
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>总年轮数</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{stats.total}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>微行动突破率</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#3d6148' }}>{stats.actionRate}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>最强韧性领域</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>
            {stats.topDomainLabel}
          </div>
        </div>
      </div>

      {/* 跨领域分布条 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
          跨领域认知分布
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DOMAIN_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
            const count = stats.domainCounts[cat.id]
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 64, color: 'var(--muted)' }}>{cat.label}</span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: 'rgba(0, 0, 0, 0.06)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: '#5a7d5a',
                      borderRadius: 3,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <span style={{ width: 36, textAlign: 'right', color: 'var(--muted)', fontSize: 11 }}>
                  {count} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        年轮默默沉淀：你不仅安放了情绪，更在真实生活里累积了应对困境的心智肌肉。
      </p>
    </div>
  )
}
