import type { SessionController } from '../useSession'

/** 进入思考路径前唯一的同意门槛。没有这一步，就没有认知挑战。 */
export default function Consent({ s }: { s: SessionController }) {
  return (
    <div className="card">
      <h1>接下来会一起检查想法，不会否定你的感受。</h1>
      <p className="muted">现在想继续吗？</p>
      <button className="primary" onClick={s.consent}>继续</button>{' '}
      <button className="ghost" onClick={s.cancelReflect}>先不了</button>
    </div>
  )
}
