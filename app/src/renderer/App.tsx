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

  return (
    <>
      <PaperForest />

      {/* 全局模型与中转站设置入口 */}
      <div
        className="global-settings-entry"
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 100,
        }}
      >
        <button
          type="button"
          className="chip"
          onClick={() => setSettingsOpen(true)}
          title="设置大模型 API / 中转站"
          aria-label="打开大模型设置"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 13px',
            fontSize: 12,
            fontWeight: 500,
            background: 'rgba(255, 252, 245, 0.78)',
            border: '1px solid rgba(210, 195, 175, 0.65)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            borderRadius: 999,
          }}
        >
          <span style={{ fontSize: 13 }}>⚙️</span>
          <span>模型设置</span>
        </button>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="shell">
        {/* key 让每一幕进场时重放一次过渡；幕内状态不受影响 */}
        <div className="scene" key={s.scene}>
          <Scene s={s} />
        </div>
      </div>
    </>
  )
}
