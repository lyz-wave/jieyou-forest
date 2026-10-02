import type { SessionController } from './useSession'
import { useSession } from './useSession'
import TreeCrest from './tree/TreeCrest'
import Watercolor from './watercolor/Watercolor'
import Express from './scenes/Express'
import Crisis from './scenes/Crisis'
import Space from './scenes/Space'
import Rest from './scenes/Rest'
import Consent from './scenes/Consent'
import Reflect from './scenes/Reflect'
import Unfinished from './scenes/Unfinished'
import RingConfirm from './scenes/RingConfirm'
import MyTree from './scenes/MyTree'

function Scene({ s }: { s: SessionController }) {
  switch (s.scene) {
    case 'express': return <Express s={s} />
    case 'crisis': return <Crisis s={s} />
    case 'space': return <Space s={s} />
    case 'rest': return <Rest s={s} />
    case 'consent': return <Consent s={s} />
    case 'reflect': return <Reflect s={s} />
    case 'unfinished': return <Unfinished s={s} />
    case 'save': return <RingConfirm s={s} />
    case 'tree': return <MyTree s={s} />
  }
}

export default function App() {
  const s = useSession()

  return (
    <>
      <Watercolor />
      <div className="shell">
        <TreeCrest />
        {/* key 让每一幕进场时重放一次过渡；幕内状态不受影响 */}
        <div className="scene" key={s.scene}>
          <Scene s={s} />
        </div>
      </div>
    </>
  )
}
