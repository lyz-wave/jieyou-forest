import type { SessionController } from '../useSession'

export default function MyTree({ s }: { s: SessionController }) {
  return (
    <>
      <h1>我的树</h1>
      <p className="sub">年轮不因为情绪好坏增减，也不会因为你没来而枯萎。</p>
      {s.rings.length === 0 && <p className="muted">还没有年轮。</p>}
      <ul className="rings">
        {s.rings.map((r) => (
          <li key={r.id}>
            <div>{r.user_note}</div>
            <div className="muted">
              {r.type === 'support' ? '陪伴年轮' : '行动年轮'}
              {r.review_due ? ' · 复盘日 ' + r.review_due : ''}
            </div>
            <button className="ghost" onClick={() => s.removeRing(r.id)}>删除</button>
          </li>
        ))}
      </ul>
      {s.notice && <p className="muted">{s.notice}</p>}
      <button className="primary" onClick={s.startOver}>再说一件</button>
    </>
  )
}
