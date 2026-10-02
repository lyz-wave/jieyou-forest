import { useSession } from './useSession'
import TreeCrest from './tree/TreeCrest'
import Express from './scenes/Express'
import Crisis from './scenes/Crisis'
import Space from './scenes/Space'
import Rest from './scenes/Rest'
import Consent from './scenes/Consent'
import Reflect from './scenes/Reflect'
import Unfinished from './scenes/Unfinished'
import RingConfirm from './scenes/RingConfirm'
import MyTree from './scenes/MyTree'

export default function App() {
  const s = useSession()

  return (
    <div className="shell">
      <TreeCrest />
      {s.scene === 'express' && <Express s={s} />}
      {s.scene === 'crisis' && <Crisis s={s} />}
      {s.scene === 'space' && <Space s={s} />}
      {s.scene === 'rest' && <Rest s={s} />}
      {s.scene === 'consent' && <Consent s={s} />}
      {s.scene === 'reflect' && <Reflect s={s} />}
      {s.scene === 'unfinished' && <Unfinished s={s} />}
      {s.scene === 'save' && <RingConfirm s={s} />}
      {s.scene === 'tree' && <MyTree s={s} />}
    </div>
  )
}
