import type { ReflectionCardId } from '../../shared/types'
import type { SessionController } from '../useSession'

const PANELS: Array<[ReflectionCardId, string]> = [
  ['guardian', '守护者：你真正想保护的需求或边界是什么？'],
  ['explorer', '探索者：有没有一个低成本、可撤回的小试验？'],
  ['outsider', '局外人：除了眼前这个解释，还有哪些可能？'],
  ['mirror', '折返镜'],
]

export default function Reflect({ s }: { s: SessionController }) {
  return (
    <>
      {PANELS.map(([key, title]) => (
        <div className="card" key={key}>
          <strong>{title}</strong>
          <p>{s.cards[key] || '……'}</p>
        </div>
      ))}
      <button className="primary" onClick={() => s.go('save')}>留下一圈年轮</button>{' '}
      <button className="ghost" onClick={() => s.go('rest')}>先歇一会儿</button>{' '}
      <button className="ghost" onClick={() => s.go('express')}>暂时不留</button>
    </>
  )
}
