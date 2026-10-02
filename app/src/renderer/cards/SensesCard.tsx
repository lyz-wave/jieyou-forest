/** 感官停顿：不请求麦克风，不要求闭眼或憋气，任选一项，可跳过。 */
const SENSES = ['一个颜色', '一个声音', '脚下的触感']

export default function SensesCard() {
  return (
    <div className="card">
      <strong>感官停顿</strong>
      <p className="muted">
        找一个你看得到的颜色、一个听得到的声音，或者脚下的触感。任选一个，也可以跳过。
      </p>
      <div className="row">
        {SENSES.map((x) => (
          <button className="chip" key={x}>{x}</button>
        ))}
      </div>
      <p className="muted">约 30–60 秒。不用闭眼，不用憋气，没有评分，也不需要用麦克风。</p>
    </div>
  )
}
