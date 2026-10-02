import { useState } from 'react'
import type { SessionController } from './useSession'
import { useSession } from './useSession'
import PaperForest from './paper/PaperForest'
import Express from './scenes/Express'
import Crisis from './scenes/Crisis'
import Space from './scenes/Space'
import Rest from './scenes/Rest'
import Consent from './scenes/Consent'
import Reflect from './scenes/Reflect'
import Unfinished from './scenes/Unfinished'
import RingConfirm from './scenes/RingConfirm'
import MyTree from './scenes/MyTree'
import SettingsModal from './settings/SettingsModal'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 纸艺舞台的两个控件原本挂在首屏上。它们是演示向的东西，对真实用户是噪音，
  // 所以搬进设置；状态提到这里，由 PaperForest 与 SettingsModal 共享。
  const [isNight, setIsNight] = useState(false)
  const [recutSignal, setRecutSignal] = useState(0)

  return (
    <>
      <PaperForest
        showControls={false}
        initialNight={isNight}
        onToggleNight={setIsNight}
        recutSignal={recutSignal}
      />

      {/* 设置入口：纯图标、低对比度。刻意不藏起来——首次使用时它是唯一能配置模型的地方。 */}
      <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 100 }}>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="设置"
          aria-label="打开设置"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            padding: 0,
            fontSize: 13,
            borderRadius: 999,
            cursor: 'pointer',
            color: 'rgba(90, 80, 66, 0.62)',
            background: 'rgba(255, 252, 245, 0.42)',
            border: '1px solid rgba(210, 195, 175, 0.38)',
            backdropFilter: 'blur(8px)',
          }}
        >
          ⚙️
        </button>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isNight={isNight}
        onToggleNight={setIsNight}
        onRecut={() => setRecutSignal((n) => n + 1)}
      />

      <div className="shell">
        {/* key 让每一幕进场时重放一次过渡；幕内状态不受影响 */}
        <div className="scene" key={s.scene}>
          <Scene s={s} />
        </div>
      </div>
    </>
  )
}
