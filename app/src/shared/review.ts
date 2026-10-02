import type { ReviewRow, RingRow } from './types'

/** 本地时区的今天，YYYY-MM-DD。review_due 由 <input type="date"> 产生，同格式可直接比较。 */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

/**
 * 这圈年轮该复盘了吗。
 *
 * 三条都必须成立，缺一不可：
 *  1. 是**行动年轮**——陪伴年轮不强制复盘（PRD F06）。
 *  2. 设了复盘日，且已经到期（含当天）。
 *  3. **还没有任何复盘记录**——复盘过一次就不再催，否则它会变成每天弹一次的骚扰。
 *
 * 第 3 条也是这个功能此前最根本的问题：用户被要求约定一个日子，
 * 而到了那天什么都不会发生，因为**根本没人读这份约定**。
 */
export function isReviewDue(ring: RingRow, reviews: ReviewRow[], today: string = todayISO()): boolean {
  if (ring.type !== 'action') return false
  if (!ring.review_due) return false
  if (ring.review_due > today) return false
  return !reviews.some((r) => r.ring_id === ring.id)
}

/** 到期未复盘的行动年轮，按复盘日从早到晚——最该先看的排前面。 */
export function dueRings(rings: RingRow[], reviews: ReviewRow[], today: string = todayISO()): RingRow[] {
  return rings
    .filter((r) => isReviewDue(r, reviews, today))
    .sort((a, b) => (a.review_due ?? '').localeCompare(b.review_due ?? ''))
}
