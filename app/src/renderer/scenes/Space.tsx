import type { SessionController } from '../useSession'

/** 承接之后的当下空间。两条路径在这里同时出现，分流发生在承接之后。 */
export default function Space({ s }: { s: SessionController }) {
  return (
    <>
      {s.banner && <div className="banner">{s.banner}</div>}
      <div className="card">{s.receive || '……'}</div>
      <div className="row">
        {s.caps.canRest && <button className="primary" onClick={() => s.choose('rest')}>先歇一会儿</button>}
        {s.caps.canReflect ? (
          <button className="ghost" onClick={() => s.choose('reflect')}>陪我想一想</button>
        ) : (
          <span className="muted">这次先不进入思考。你可以随时去休息。</span>
        )}
        <button className="ghost" onClick={() => s.go('express')}>今天先到这里</button>
      </div>
      {!s.banner && (
        <button className="ghost" onClick={s.retryReceive}>重试这次回应</button>
      )}
    </>
  )
}
