import { useState } from 'react'
import type { SessionController } from '../useSession'
import type { RingType } from '../../shared/types'

export default function RingConfirm({ s }: { s: SessionController }) {
  const [kind, setKind] = useState<RingType>('support')
  const [note, setNote] = useState('')
  const [saveOriginal, setSaveOriginal] = useState(false)
  const [action, setAction] = useState('')
  const [criterion, setCriterion] = useState('')
  const [reviewDue, setReviewDue] = useState('')

  return (
    <div className="card">
      <strong>留下一圈年轮</strong>
      <div className="row">
        <button className="chip" aria-pressed={kind === 'support'} onClick={() => setKind('support')}>
          陪伴年轮（只要一句观察）
        </button>
        <button className="chip" aria-pressed={kind === 'action'} onClick={() => setKind('action')}>
          行动年轮（带一个小实验）
        </button>
      </div>
      <label className="field">你自己的一句话</label>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      {kind === 'action' && (
        <>
          <label className="field">一个小行动</label>
          <input type="text" value={action} onChange={(e) => setAction(e.target.value)} />
          <label className="field">怎么算做到了（可观察的判据）</label>
          <input type="text" value={criterion} onChange={(e) => setCriterion(e.target.value)} />
          <label className="field">什么时候回来看（复盘日）</label>
          <input type="date" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} />
        </>
      )}
      <label className="field">
        <input type="checkbox" checked={saveOriginal} onChange={(e) => setSaveOriginal(e.target.checked)} />{' '}
        同时保存原文
      </label>
      <p className="muted">
        会保留：你这句话、这圈年轮的时间、类型
        {saveOriginal ? '，以及你写的那段原文' : '（不含原文）'}。数据只存在这台电脑上，不加密。
      </p>
      <button
        className="primary"
        disabled={!note.trim()}
        onClick={() =>
          s.saveRing({
            type: kind,
            userNote: note,
            saveOriginal,
            originalText: saveOriginal ? s.input : undefined,
            action: action || undefined,
            criterion: criterion || undefined,
            reviewDue: reviewDue || undefined,
          })
        }
      >
        保存
      </button>{' '}
      <button className="ghost" onClick={() => s.go('express')}>不保存</button>
    </div>
  )
}
