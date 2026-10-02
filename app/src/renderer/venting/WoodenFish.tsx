import { useState, useRef, useEffect, useCallback } from 'react'

export interface WoodenFishProps {
  onCalmed: () => void
}

interface FloatingText {
  id: number
  text: string
  x: number
  y: number
}

const BLESSINGS = [
  '心安 +1',
  '烦恼 -1',
  '放下一寸',
  '呼气...',
  '专注当下',
  '舒展眉头',
  '心定气舒',
  '杂念消散',
]

export default function WoodenFish({ onCalmed }: WoodenFishProps) {
  const [knocks, setKnocks] = useState(0)
  const [isStriking, setIsStriking] = useState(false)
  const [floatings, setFloatings] = useState<FloatingText[]>([])
  const [isAuto, setIsAuto] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const autoTimerRef = useRef<number | null>(null)

  // Web Audio 物理建模木质打击声
  const playKnockAudio = useCallback(() => {
    if (isMuted) return
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      // 仿真红木空腔声
      osc.type = 'sine'
      osc.frequency.setValueAtTime(420, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(580, ctx.currentTime)
      filter.Q.setValueAtTime(3.2, ctx.currentTime)

      gain.gain.setValueAtTime(0.7, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.16)
    } catch {
      // 容错降级
    }
  }, [isMuted])

  // 执行敲击
  const doKnock = useCallback(
    (offsetX = 0, offsetY = 0) => {
      setIsStriking(true)
      setTimeout(() => setIsStriking(false), 140)

      playKnockAudio()

      setKnocks((k) => {
        const next = k + 1
        if (next >= 10) {
          // 敲击满10次后自动达成平复
          onCalmed()
        }
        return next
      })

      // 飘字动效
      const newText: FloatingText = {
        id: Date.now() + Math.random(),
        text: BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)],
        x: offsetX || (Math.random() * 60 - 30),
        y: offsetY || -30,
      }
      setFloatings((prev) => [...prev.slice(-6), newText])
    },
    [onCalmed, playKnockAudio],
  )

  // 自动节律
  useEffect(() => {
    if (isAuto) {
      autoTimerRef.current = window.setInterval(() => {
        doKnock(0, -35)
      }, 1000)
    } else if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
    }
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current)
    }
  }, [isAuto, doKnock])

  // 定时清理飘字
  useEffect(() => {
    if (floatings.length === 0) return undefined
    const timer = setTimeout(() => {
      setFloatings((list) => list.slice(1))
    }, 1200)
    return () => clearTimeout(timer)
  }, [floatings])

  return (
    <div className="card wooden-fish-box" style={{ padding: '22px 20px', textAlign: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          🪵 禅音木鱼 · 沉浸叩击
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="ghost"
            style={{ padding: '3px 8px', fontSize: 12, height: 'auto' }}
            onClick={() => setIsMuted((m) => !m)}
            title={isMuted ? '点击开启声音' : '点击静音'}
          >
            {isMuted ? '🔇 静音' : '🔊 声音'}
          </button>
          <button
            className="ghost"
            style={{ padding: '4px 10px', fontSize: 12, height: 'auto' }}
            onClick={onCalmed}
          >
            好受些了
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
        轻点木鱼，在笃笃声中安放心神。敲满 10 次或心绪平稳时，即可收拢思绪。
      </p>

      {/* 木鱼主体交互区 */}
      <div
        style={{
          position: 'relative',
          height: 180,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          userSelect: 'none',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ox = e.clientX - rect.left - rect.width / 2
          const oy = e.clientY - rect.top - rect.height / 2
          doKnock(ox, oy)
        }}
      >
        {/* 拟态木鱼 SVG */}
        <svg
          viewBox="-70 -60 140 120"
          width="150"
          height="130"
          style={{
            transform: isStriking ? 'scale(0.92) translateY(4px)' : 'scale(1)',
            transition: 'transform 0.12s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
            filter: 'drop-shadow(0 10px 18px rgba(65, 45, 25, 0.22))',
          }}
        >
          <defs>
            <radialGradient id="woodGradient" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#8d6849" />
              <stop offset="70%" stopColor="#67472e" />
              <stop offset="100%" stopColor="#432c1b" />
            </radialGradient>
            <linearGradient id="slitGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2c1a0e" />
              <stop offset="100%" stopColor="#1a0f08" />
            </linearGradient>
          </defs>

          {/* 外壳阴影底衬 */}
          <path
            d="M-45,20 C-50,-25 -20,-50 15,-48 C45,-46 55,-15 50,22 C45,45 -35,48 -45,20 Z"
            fill="url(#woodGradient)"
            stroke="#3a2517"
            strokeWidth="2.5"
          />

          {/* 木鱼眼与背脊纹路 */}
          <circle cx="-16" cy="-22" r="7" fill="#4d3420" stroke="#332012" strokeWidth="1.5" />
          <circle cx="-16" cy="-22" r="3" fill="#2c1a0e" />

          {/* 鱼嘴开口缝隙 */}
          <path
            d="M-42,16 Q-10,25 35,12 Q45,18 42,26 Q-5,36 -42,24 Z"
            fill="url(#slitGradient)"
          />

          {/* 敲击受力高光区域 */}
          <ellipse cx="14" cy="-15" rx="18" ry="12" fill="rgba(255, 255, 255, 0.12)" />
        </svg>

        {/* 敲击涟漪 */}
        {isStriking && (
          <div
            style={{
              position: 'absolute',
              width: 130,
              height: 130,
              borderRadius: '50%',
              border: '2px solid rgba(141, 104, 73, 0.4)',
              animation: 'ripplePing 0.5s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* 动态飘浮文字 */}
        {floatings.map((f) => (
          <span
            key={f.id}
            style={{
              position: 'absolute',
              left: `calc(50% + ${f.x}px)`,
              top: `calc(50% + ${f.y}px)`,
              fontSize: 14,
              fontWeight: 700,
              color: '#3d5735',
              background: 'rgba(255, 255, 255, 0.92)',
              padding: '2px 8px',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              pointerEvents: 'none',
              animation: 'floatUpFade 1.1s cubic-bezier(0.1, 0.8, 0.2, 1) forwards',
              whiteSpace: 'nowrap',
            }}
          >
            {f.text}
          </span>
        ))}
      </div>

      {/* 计数与提示 */}
      <div style={{ marginTop: 6 }}>
        <span
          className="chip"
          style={{
            fontSize: 12,
            background: knocks >= 10 ? 'rgba(99, 139, 88, 0.16)' : 'rgba(0,0,0,0.06)',
            color: knocks >= 10 ? '#385e30' : 'var(--muted)',
            fontWeight: 600,
          }}
        >
          已叩击：{knocks} 次 {knocks >= 10 ? '（心定安宁已至）' : ''}
        </span>
      </div>

      {/* 控制操作栏 */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
        <button
          className="ghost"
          style={{ fontSize: 13, padding: '5px 12px' }}
          onClick={() => setIsAuto((a) => !a)}
        >
          {isAuto ? '⏸ 停止自动律动' : '▶ 自动舒缓敲击 (60 BPM)'}
        </button>
        <button className="primary" style={{ fontSize: 13, padding: '5px 16px' }} onClick={onCalmed}>
          心里好受些了
        </button>
      </div>
    </div>
  )
}
