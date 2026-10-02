import type { SessionController } from '../useSession'

const EMOTIONS = ['生气', '难过', '焦虑', '委屈', '疲惫', '平静', '说不清']

export default function Express({ s }: { s: SessionController }) {
  return (
    <>
      <h1>今天想放下的，是心事，还是事情？</h1>
      <p className="sub">先安放情绪，再看清问题。你可以只歇一会儿，不必每次都成长。</p>
      <textarea
        value={s.input}
        maxLength={2000}
        placeholder="写一句就好，不用讲完整"
        onChange={(e) => s.setInput(e.target.value)}
      />
      <div className="row">
        {EMOTIONS.map((e) => (
          <button
            key={e}
            className="chip"
            aria-pressed={s.emotion === e}
            onClick={() => s.setEmotion(s.emotion === e ? undefined : e)}
          >
            {e}
          </button>
        ))}
      </div>
      <p className="muted">标签只是给你自己看的，随时可以改。默认不保存原文。</p>
      <button className="primary" onClick={s.submit} disabled={!s.input.trim()}>说完了</button>
      {s.notice && <p className="muted">{s.notice}</p>}
    </>
  )
}
