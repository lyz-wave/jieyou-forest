import type { SessionController } from '../useSession'

export default function Crisis({ s }: { s: SessionController }) {
  return (
    <div className="card crisis">
      <h1>先停在这里</h1>
      <p>你写下的内容里，有一些需要被人当面接住的东西。这会儿不适合继续做任何练习或思考。</p>
      <p>如果你正处在即时危险中，请联系当地的紧急服务，或找一个你现在能联系上的、信得过的人。</p>
      <p className="muted">
        地区求助资源需要赛前核验后填入（见架构文档 §9 未决项）。在有人认领并核验之前，这里不会编造任何号码。
      </p>
      <p className="muted">如果你说的不是这个意思，可以更正——但更正之后仍然只会回到休息，不会进入思考。</p>
      <button className="ghost" onClick={s.correct}>我说的不是这个意思</button>
    </div>
  )
}
