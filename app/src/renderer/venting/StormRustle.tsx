import { useEffect, useState } from 'react'

export interface StormRustleProps {
  onCalmed: () => void
}

export default function StormRustle({ onCalmed }: StormRustleProps) {
  const [windLevel, setWindLevel] = useState(1)
  const [gusts, setGusts] = useState<number[]>([])

  const triggerGust = () => {
    setWindLevel((w) => Math.min(5, w + 1))
    setGusts((g) => [...g.slice(-8), Date.now()])
  }

  // 移动端晃动手机监听
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0
    let lastTime = 0

    const onMotion = (e: DeviceMotionEvent) => {
      const cur = e.accelerationIncludingGravity
      if (!cur || cur.x === null || cur.y === null || cur.z === null) return
      const now = performance.now()
      if (now - lastTime > 150) {
        const diff = Math.abs(cur.x - lastX) + Math.abs(cur.y - lastY) + Math.abs(cur.z - lastZ)
        if (diff > 14) {
          triggerGust()
        }
        lastX = cur.x
        lastY = cur.y
        lastZ = cur.z
        lastTime = now
      }
    }

    if (typeof window !== 'undefined' && 'ondevicemotion' in window) {
      window.addEventListener('devicemotion', onMotion)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('devicemotion', onMotion)
      }
    }
  }, [])

  return (
    <div className="card storm-rustle-box" style={{ padding: '24px 20px', textAlign: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          🌪️ 暴风摇树 · 刮走沉重
        </span>
        <button
          className="ghost"
          style={{ padding: '4px 10px', fontSize: 12, height: 'auto' }}
          onClick={onCalmed}
        >
          好受些了
        </button>
      </div>

      <div style={{ margin: '14px 0', position: 'relative', height: 160, overflow: 'hidden' }} onClick={triggerGust}>
        {/* 动态摇摆树木 SVG */}
        <svg
          viewBox="-60 -100 120 120"
          width="130"
          height="130"
          className={`storm-tree-svg wind-${windLevel}`}
          style={{ cursor: 'pointer' }}
        >
          {/* 树干 */}
          <path d="M-6,20 Q0,-30 -2,-70 Q1,-30 6,20 Z" fill="#69513d" />
          {/* 树枝 */}
          <path d="M-2,-35 Q-20,-48 -35,-42" stroke="#69513d" strokeWidth="3" fill="none" />
          <path d="M0,-48 Q20,-60 38,-50" stroke="#69513d" strokeWidth="2.5" fill="none" />
          {/* 树冠 */}
          <circle cx="-16" cy="-60" r="22" fill="#5a7d5a" opacity="0.85" />
          <circle cx="16" cy="-65" r="20" fill="#4d6f4d" opacity="0.85" />
          <circle cx="0" cy="-80" r="24" fill="#6e916e" opacity="0.9" />
          {/* 枯叶标记 */}
          <circle cx="-25" cy="-55" r="5" fill="#c8642d" />
          <circle cx="22" cy="-58" r="4.5" fill="#d9a45b" />
          <circle cx="5" cy="-75" r="4" fill="#b04825" />
        </svg>

        {/* 随风狂飘的枯叶粒子 */}
        {gusts.map((t, idx) => (
          <span key={t} className={`storm-leaf-particle storm-leaf-${idx % 5}`} />
        ))}

        <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0 }}>
          <span className="chip" style={{ fontSize: 12, background: 'rgba(0,0,0,0.06)' }}>
            风力等级：{windLevel} 级 {windLevel >= 4 ? '（狂风呼啸中）' : ''}
          </span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 16px' }}>
        摇晃或狂击掀起暴风，让满树积压的枯叶随风散去
      </p>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="primary" onClick={triggerGust}>
          狂击掀风
        </button>
        <button className="ghost" onClick={onCalmed}>
          心里好受些了
        </button>
      </div>
    </div>
  )
}
