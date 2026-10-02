import { useState } from 'react'
import type { ReviewDraft, ReviewOutcome, ReviewRow, RingRow } from '../../shared/types'

const OPTIONS: Array<[ReviewOutcome, string]> = [
  ['done', '做到了'],
  ['not_done', '没做到'],
  ['changed', '情况变了'],
  ['unclear', '说不清'],
]

const LABELS: Record<ReviewOutcome, string> = {
  done: '做到了',
  not_done: '没做到',
  changed: '情况变了',
  unclear: '说不清',
}

/**
 * 行动年轮的复盘。
 *
 * 两条设计上的取舍：
 *
 * 1. **四选一而不是"成功/失败"**。情况变了、说不清都是真实且常见的结局；
 *    只有二元选项时，用户会被迫把这两类硬塞进"没做到"——那就成了评判，
 *    而这个产品的立场是不评判。
 *
 * 2. **复盘是新增一条记录，永远不覆盖年轮里的原决定**（PRD F06 验收）。
 *    复盘的目的是看见变化，不是改写历史：原决定就在上面那块里，一直看得见。
 */
export default function RingReview({
  ring,
  reviews,
  due,
  onSave,
}: {
  ring: RingRow
  reviews: ReviewRow[]
  due: boolean
  onSave: (draft: ReviewDraft) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (ring.type !== 'action') return null

  const submit = async () => {
    if (!outcome || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({ outcome, observedResult: text.trim() })
      setOpen(false)
      setOutcome(null)
      setText('')
    } catch {
      // 保存失败必须说出来。静默失败会让用户以为记下了，而那条记录不存在。
      setError('没能保存这次复盘，请再试一次。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {reviews.map((r) => (
        <div
          key={r.id}
          style={{
            background: 'rgba(109, 141, 92, 0.1)',
            borderLeft: '3px solid #6d8d5c',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <div>
            <strong>复盘 {r.created_at.slice(0, 10)}：</strong>
            {r.outcome ? LABELS[r.outcome] : '（早期记录，没有选项）'}
          </div>
          {r.observed_result && (
            <div style={{ marginTop: 4, color: 'var(--text)' }}>{r.observed_result}</div>
          )}
        </div>
      ))}

      {!open && (
        <button className="ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setOpen(true)}>
          {due ? '到期了，复盘这次行动' : reviews.length > 0 ? '再复盘一次' : '复盘这次行动'}
        </button>
      )}

      {open && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(180, 160, 130, 0.35)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>那件小行动，后来怎么样了？</div>
          <div className="row" style={{ marginBottom: 10 }}>
            {OPTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="chip"
                aria-pressed={outcome === id}
                onClick={() => setOutcome(outcome === id ? null : id)}
                style={{
                  fontSize: 12,
                  padding: '5px 11px',
                  fontWeight: outcome === id ? 600 : 400,
                  border: outcome === id ? '1px solid #4a8d5c' : undefined,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <textarea
            value={text}
            maxLength={500}
            placeholder="想说就补一句，不想说也行"
            onChange={(e) => setText(e.target.value)}
            style={{ minHeight: 64, fontSize: 13 }}
          />

          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={submit} disabled={!outcome || saving}>
              {saving ? '正在保存…' : '记下这次复盘'}
            </button>
            <button className="ghost" onClick={() => setOpen(false)} disabled={saving}>
              先不写
            </button>
          </div>
          {error && (
            <p className="muted" style={{ color: '#9c4a3c', marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
