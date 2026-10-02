import { describe, expect, it } from 'vitest'
import { dueRings, isReviewDue, todayISO } from './review'
import type { ReviewRow, RingRow } from './types'

function ring(over: Partial<RingRow> = {}): RingRow {
  return {
    id: 'r1', session_id: 's1', type: 'action', user_note: '一句话',
    save_original: 0, original_text: null, user_decision: '决定',
    action: '明天找导师核实', criterion: '得到明确结论', review_due: '2026-10-01',
    created_at: '2026-09-24', is_demo: 0, idempotency_key: 'k1',
    ...over,
  }
}
function review(ringId: string): ReviewRow {
  return {
    id: 'rv1', ring_id: ringId, outcome: 'done', observed_result: '做到了',
    premise_update: null, next_step: null, created_at: '2026-10-02',
  }
}

describe('到该复盘的时候了吗', () => {
  const today = '2026-10-02'

  it('到期当天算到期', () => {
    expect(isReviewDue(ring({ review_due: '2026-10-02' }), [], today)).toBe(true)
  })

  it('还没到就不算', () => {
    expect(isReviewDue(ring({ review_due: '2026-10-03' }), [], today)).toBe(false)
  })

  it('过期了算到期', () => {
    expect(isReviewDue(ring({ review_due: '2026-09-01' }), [], today)).toBe(true)
  })

  it('陪伴年轮不强制复盘——它有复盘日也不催', () => {
    expect(isReviewDue(ring({ type: 'support' }), [], today)).toBe(false)
  })

  it('没设复盘日就不催', () => {
    expect(isReviewDue(ring({ review_due: null }), [], today)).toBe(false)
  })

  it('已经复盘过就不再催——否则它会变成每天弹一次的骚扰', () => {
    expect(isReviewDue(ring(), [review('r1')], today)).toBe(false)
  })

  it('别的年轮的复盘记录不算数', () => {
    expect(isReviewDue(ring(), [review('r999')], today)).toBe(true)
  })

  it('只返回到期未复盘的，且最早到期的排最前', () => {
    const rings = [
      ring({ id: 'a', review_due: '2026-09-20' }),
      ring({ id: 'b', review_due: '2026-09-25' }),
      ring({ id: 'c', review_due: '2026-12-01' }),   // 还没到
      ring({ id: 'd', type: 'support' }),             // 陪伴年轮
      ring({ id: 'e', review_due: '2026-09-01' }),   // 到期但已复盘
    ]
    const due = dueRings(rings, [review('e')], today)
    expect(due.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('今天用本地时区，不因为 UTC 差一天', () => {
    // 本地 2026-01-01 00:30 —— UTC 还是 2025-12-31
    const d = new Date(2026, 0, 1, 0, 30)
    expect(todayISO(d)).toBe('2026-01-01')
  })
})
