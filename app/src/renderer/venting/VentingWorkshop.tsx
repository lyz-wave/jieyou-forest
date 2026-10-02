import { useState } from 'react'
import type { SessionController } from '../useSession'
import PaperShredder from './PaperShredder'
import LeafCard from '../cards/LeafCard'
import SensesCard from '../cards/SensesCard'

export interface VentingWorkshopProps {
  s: SessionController
}

export default function VentingWorkshop({ s }: VentingWorkshopProps) {
  const [calmed, setCalmed] = useState(false)
  const [showTranquilCards, setShowTranquilCards] = useState(true)

  return (
    <div className="venting-workshop">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>情绪宣泄工坊</h1>
        <p className="sub" style={{ margin: '6px 0 0' }}>
          把情绪安放在这里。你可以揉碎它，也可以只歇一会儿。
        </p>
      </div>

      {/* 核心宣泄玩具：纸团揉碎撕裂 */}
      <PaperShredder
        text={s.input}
        onCalmed={() => setCalmed(true)}
      />

      {/* 微风平息与自选转念卡片 */}
      {calmed && (
        <div
          className="card calm-transition-banner"
          style={{
            padding: '24px 22px',
            marginBottom: 24,
            animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            borderLeft: '4px solid #82aa82',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🍃</span>
            <strong style={{ fontSize: 16 }}>微风平息 · 停顿片刻</strong>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
            心跳慢下来了吗？如果准备好了，可以换几个视角看清它。
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="primary" onClick={() => s.go('consent')}>
              陪我想一想
            </button>
            <button className="ghost" onClick={() => s.go('save')}>
              留下一圈年轮
            </button>
            <button className="ghost" onClick={() => s.go('express')}>
              今天先到这里
            </button>
          </div>
        </div>
      )}

      {/* 沉静舒缓卡片容器 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, margin: 0, color: 'var(--muted)', fontWeight: 600 }}>
            两张卡，随便挑，随时能换
          </h2>
          <button
            className="ghost"
            style={{ fontSize: 12, padding: '3px 8px', height: 'auto' }}
            onClick={() => setShowTranquilCards((v) => !v)}
          >
            {showTranquilCards ? '收起' : '展开'}
          </button>
        </div>

        {showTranquilCards && (
          <>
            <LeafCard />
            <SensesCard />
          </>
        )}

        {!calmed && (
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="primary" onClick={() => s.go('save')}>
              留下一圈年轮
            </button>
            <button className="ghost" onClick={() => s.go('express')}>
              今天先到这里
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
