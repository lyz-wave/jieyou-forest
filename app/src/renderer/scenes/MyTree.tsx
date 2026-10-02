import { useState, useMemo } from 'react'
import type { SessionController } from '../useSession'
import TrunkRingsDisc, {
  DOMAIN_CATEGORIES,
  DomainCategory,
  inferRingDomain,
  inferRingEmotion,
  EMOTION_THEMES,
} from '../tree/TrunkRingsDisc'
import ResilienceProfile from '../tree/ResilienceProfile'
import RingReview from '../tree/RingReview'


export default function MyTree({ s }: { s: SessionController }) {
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<DomainCategory>('all')

  const selectedRing = useMemo(() => {
    return s.rings.find((r) => r.id === selectedRingId) ?? null
  }, [s.rings, selectedRingId])

  const filteredRings = useMemo(() => {
    if (activeCategory === 'all') return s.rings
    return s.rings.filter((r) => inferRingDomain(r) === activeCategory)
  }, [s.rings, activeCategory])

  const categoryCounts = useMemo(() => {
    const counts: Record<DomainCategory, number> = {
      all: s.rings.length,
      work: 0,
      relationship: 0,
      self: 0,
      creative: 0,
    }
    s.rings.forEach((r) => {
      const d = inferRingDomain(r)
      counts[d] = (counts[d] || 0) + 1
    })
    return counts
  }, [s.rings])

  const handleSelectRing = (id: string) => {
    setSelectedRingId((prev) => (prev === id ? null : id))
  }

  return (
    <>
      <h1>我的树</h1>
      <p className="sub">年轮不因为情绪好坏增减，也不会因为你没来而枯萎。</p>

      {s.rings.length === 0 ? (
        <p className="muted">还没有年轮。</p>
      ) : (
        <>
          {/* 领域分类筛选器 */}
          <div className="trunk-category-bar" role="tablist" aria-label="年轮领域分类">
            {DOMAIN_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className="chip"
                aria-pressed={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label} {categoryCounts[cat.id] > 0 ? `(${categoryCounts[cat.id]})` : ''}
              </button>
            ))}
          </div>

          {/* 交互式同心年轮木桩盘 */}
          <TrunkRingsDisc
            rings={s.rings}
            selectedRingId={selectedRingId}
            activeCategory={activeCategory}
            onSelectRing={handleSelectRing}
          />

          {/* 个人认知韧性图谱 */}
          <ResilienceProfile rings={s.rings} />


          {/* 年轮详情展开卡片 */}
          {selectedRing && (
            <div className="trunk-detail-card" data-testid="ring-detail-drawer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="chip" style={{ fontWeight: 600 }}>
                    {selectedRing.type === 'support' ? '陪伴年轮' : '行动年轮'}
                  </span>
                  <span
                    className="chip"
                    style={{
                      background: EMOTION_THEMES[inferRingEmotion(selectedRing)].fill,
                      color: EMOTION_THEMES[inferRingEmotion(selectedRing)].color,
                      fontWeight: 600,
                    }}
                  >
                    {EMOTION_THEMES[inferRingEmotion(selectedRing)].label}
                  </span>
                  <span className="chip" style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {DOMAIN_CATEGORIES.find((c) => c.id === inferRingDomain(selectedRing))?.label}
                  </span>
                </div>
                <button
                  className="ghost"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => setSelectedRingId(null)}
                >
                  收起
                </button>
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '8px 0', lineHeight: 1.5 }}>
                {selectedRing.user_note}
              </div>

              {/* 当时的决定必须显示出来。它是复盘的对照物——
                  原决定不出现，"复盘不覆盖原决定"这条验收就无从谈起：
                  你看不到自己当初决定了什么，也就看不出后来变了没有。 */}
              {selectedRing.type === 'action' && selectedRing.user_decision && (
                <div
                  style={{
                    background: 'rgba(255, 252, 246, 0.8)',
                    borderLeft: '3px solid rgba(180, 160, 130, 0.6)',
                    padding: '10px 12px',
                    borderRadius: 8,
                    margin: '8px 0',
                    fontSize: 13,
                  }}
                >
                  <strong>当时的决定：</strong>
                  {selectedRing.user_decision}
                </div>
              )}

              {selectedRing.type === 'action' && selectedRing.action && (
                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px 12px', borderRadius: 8, margin: '8px 0', fontSize: 13 }}>
                  <div><strong>微行动：</strong>{selectedRing.action}</div>
                  {selectedRing.criterion && (
                    <div style={{ marginTop: 4, color: 'var(--muted)' }}><strong>可验证判据：</strong>{selectedRing.criterion}</div>
                  )}
                  {selectedRing.review_due && (
                    <div style={{ marginTop: 4, color: 'var(--muted)' }}><strong>复盘约定日：</strong>{selectedRing.review_due}</div>
                  )}
                </div>
              )}

              {/* 复盘。放在原决定的正下方——两者并列，复盘永不覆盖原决定。 */}
              <RingReview
                ring={selectedRing}
                reviews={s.reviews.filter((r) => r.ring_id === selectedRing.id)}
                due={s.due.some((r) => r.id === selectedRing.id)}
                onSave={(draft) => s.saveReview(selectedRing.id, draft)}
              />

              {selectedRing.save_original === 1 && selectedRing.original_text && (
                <div style={{ margin: '8px 0', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                  当时的心事原文：{selectedRing.original_text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  className="ghost"
                  style={{ color: '#9c4a3c' }}
                  onClick={() => {
                    s.removeRing(selectedRing.id)
                    setSelectedRingId(null)
                  }}
                >
                  删除这圈年轮
                </button>
              </div>
            </div>
          )}

          {/* 年轮记录流 */}
          <ul className="rings">
            {filteredRings.map((r) => (
              <li
                key={r.id}
                onClick={() => handleSelectRing(r.id)}
                style={{
                  cursor: 'pointer',
                  background: selectedRingId === r.id ? 'rgba(255,255,255,0.45)' : undefined,
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 6,
                  transition: 'background 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>{r.user_note}</div>
                  <button
                    className="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (selectedRingId === r.id) setSelectedRingId(null)
                      s.removeRing(r.id)
                    }}
                  >
                    删除
                  </button>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {r.type === 'support' ? '陪伴年轮' : '行动年轮'}
                  {r.review_due ? ' · 复盘日 ' + r.review_due : ''}
                  {s.due.some((d) => d.id === r.id) ? ' · 到期了' : ''}
                  {' · ' + EMOTION_THEMES[inferRingEmotion(r)].label}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {s.notice && <p className="muted">{s.notice}</p>}
      <button className="primary" onClick={s.startOver}>再说一件</button>
    </>
  )
}
