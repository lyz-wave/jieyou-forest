import { useEffect, useState } from 'react'
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
import CampfireCouncil from './paper/CampfireCouncil'

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

  // 动物按你的状态分层。这里只需要知道"你是不是正在写字"——
  // 一动手它们就安静，这一条让八只动物和"首页只剩一句话一个输入框"不必二选一。
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) setTyping(true)
    }
    const onOut = () => setTyping(false)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])

  const isCampfire = s.scene === 'space' || s.scene === 'reflect'

  return (
    <>
      <PaperForest
        showControls={false}
        initialNight={isNight}
        onToggleNight={setIsNight}
        recutSignal={recutSignal}
      />

      {/* 八只思维动物与温暖篝火。压在内容之下、纸艺舞台之上。 */}
      <CampfireCouncil
        s={s}
        mode={isCampfire ? 'campfire' : 'roam'}
        isQuiet={typing}
      />

      {/* 「我的树」的常驻入口。
          在此之前，全应用只有两个地方能进树：承接页里那张**只在有共鸣时才出现**的
          年轮共鸣卡片，以及刚保存完年轮那一刻的「看看我的树」。
          也就是说：保存一圈年轮 → 看到树 → 点「再说一件」回首页 → **从此再也回不去了**。
          这个产品的全部积累在结构上不可达。
          角标上的数字本身就是积累感——没有年轮时不显示角标，而不是显示 0。 */}
      <div style={{ position: 'fixed', top: 14, right: 52, zIndex: 100 }}>
        <button
          type="button"
          onClick={s.openTree}
          title={s.rings.length > 0 ? `我的树（${s.rings.length} 圈年轮）` : '我的树'}
          aria-label={s.rings.length > 0 ? `打开我的树，共 ${s.rings.length} 圈年轮` : '打开我的树'}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            padding: 0,
            fontSize: 13,
            lineHeight: 1,
            borderRadius: 999,
            cursor: 'pointer',
            color: 'rgba(90, 80, 66, 0.62)',
            background: 'rgba(255, 252, 245, 0.42)',
            border: '1px solid rgba(210, 195, 175, 0.38)',
            backdropFilter: 'blur(8px)',
          }}
        >
          🌳
          {s.rings.length > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                minWidth: 15,
                height: 15,
                padding: '0 3px',
                borderRadius: 999,
                background: 'rgba(74, 141, 92, 0.92)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: '15px',
                textAlign: 'center',
              }}
            >
              {s.rings.length}
            </span>
          )}
        </button>
      </div>

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

      {/* 昼夜开关放在右下角，而不是设置里。
          切换会带动整个背景一段过渡动画，而设置弹窗的暗色蒙层 + 12px 模糊
          会把那段动画完全盖住——你会看不见自己刚触发的那件事。
          重剪则留在设置里：它重建数百个 DOM 节点，是重操作，该待在需要专门去找的地方。 */}
      <div style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 100 }}>
        <button
          type="button"
          onClick={() => setIsNight((v) => !v)}
          aria-pressed={isNight}
          title={isNight ? '切换到白昼' : '切换到静夜'}
          aria-label={isNight ? '切换到白昼' : '切换到静夜'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            padding: 0,
            fontSize: 13,
            lineHeight: 1,
            borderRadius: 999,
            cursor: 'pointer',
            color: 'rgba(90, 80, 66, 0.62)',
            background: 'rgba(255, 252, 245, 0.42)',
            border: '1px solid rgba(210, 195, 175, 0.38)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {isNight ? '☀️' : '🌙'}
        </button>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRecut={() => setRecutSignal((n) => n + 1)}
        onClearAll={s.clearAllData}
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
