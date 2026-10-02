import { useState, useMemo } from 'react'
import type { SessionController } from '../useSession'
import TrunkRingsDisc, { RING_TYPE_FILTERS, RingTypeFilter, ringTone } from '../tree/TrunkRingsDisc'
import RingFacts from '../tree/RingFacts'
import RingReview from '../tree/RingReview'


export default function MyTree({ s }: { s: SessionController }) {
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<RingTypeFilter>('all')

  const selectedRing = useMemo(() => {
    return s.rings.find((r) => r.id === selectedRingId) ?? null
  }, [s.rings, selectedRingId])

  // 筛选维度是**年轮类型**——数据库里的字段，不是系统推断出来的分类。
  // 原来按「职场/人际/自我/创意」筛，而那四格是用关键词正则猜的：
  // "这件事算工作还是算关系"本身就是被强加的框架，而且经常猜错。
  const filteredRings = useMemo(() => {
    if (activeType === 'all') return s.rings
    return s.rings.filter((r) => ringTone(r) === activeType)
  }, [s.rings, activeType])

  const typeCounts = useMemo(() => {
    const counts: Record<RingTypeFilter, number> = { all: s.rings.length, support: 0, action: 0 }
    s.rings.forEach((r) => {
      counts[ringTone(r)] += 1
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
          {/* 按年轮类型筛选。这是数据库里的字段，可核对，不会猜错。 */}
          <div className="trunk-category-bar" role="tablist" aria-label="年轮类型筛选">
            {RING_TYPE_FILTERS.map((t) => (
              <button
                key={t.id}
                className="chip"
                aria-pressed={activeType === t.id}
                onClick={() => setActiveType(t.id)}
              >
                {t.label} {typeCounts[t.id] > 0 ? `(${typeCounts[t.id]})` : ''}
              </button>
            ))}
          </div>

          {/* 交互式同心年轮木桩盘 */}
          <TrunkRingsDisc
            rings={s.rings}
            selectedRingId={selectedRingId}
            activeType={activeType}
            onSelectRing={handleSelectRing}
          />

          {/* 个人认知韧性图谱 */}
          <RingFacts rings={s.rings} reviews={s.reviews} />


          {/* 年轮详情展开卡片 */}
          {selectedRing && (
            <div className="trunk-detail-card" data-testid="ring-detail-drawer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="chip" style={{ fontWeight: 600 }}>
                    {selectedRing.type === 'support' ? '陪伴年轮' : '行动年轮'}
                  </span>
                  {/* 这里原本还有两枚标签：「激愤释放 / 焦虑紧绷 / 悲伤委屈…」
                      和「职场工作 / 人际亲密 / 自我认同 / 创意探索」。
                      前者是系统在替用户定义他当时的感受，后者是系统在替他框定处境——
                      两者都由关键词正则猜出来，且没有任何"这是推断"的标注，用户也无从否认。
                      都删了。系统不对用户的感受下判断，也不替他分类处境。 */}
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
