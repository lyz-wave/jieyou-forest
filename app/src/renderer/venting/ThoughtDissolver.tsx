import { useState, useRef, useEffect } from 'react'

export interface ThoughtDissolverProps {
  text: string
  onCalmed: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  rotation: number
  vRot: number
  life: number
}

export default function ThoughtDissolver({ text, onCalmed }: ThoughtDissolverProps) {
  const [phase, setPhase] = useState<'flat' | 'crumpled' | 'shredded'>('flat')
  const [crumpleProgress, setCrumpleProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const handleCrumple = () => {
    setPhase('crumpled')
  }

  const handleTapPaper = () => {
    if (crumpleProgress < 1) {
      setCrumpleProgress((p) => p + 1)
    } else {
      setPhase('crumpled')
    }
  }

  // 粒子爆炸动画
  const startParticleExplosion = () => {
    setPhase('shredded')
    onCalmed()

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.parentElement?.clientWidth || 340
    canvas.height = 180

    const particles: Particle[] = []
    const colors = ['#eee5d0', '#dfcfae', '#cfbe9a', '#6d8d5c', '#89aa78', '#fffbf2']
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // 产生 100 颗微物理粒子
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 5 + 1.5
      particles.push({
        x: centerX + (Math.random() * 20 - 10),
        y: centerY + (Math.random() * 20 - 10),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2, // 初始稍向上扬
        size: Math.random() * 5 + 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.15,
        life: 1,
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let activeCount = 0

      for (const p of particles) {
        if (p.life > 0) {
          activeCount++
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.04 // 极轻微重力
          p.vx *= 0.98 // 空气阻力
          p.rotation += p.vRot
          p.life -= 0.012
          p.alpha = Math.max(0, p.life)

          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          ctx.fillStyle = p.color
          ctx.globalAlpha = p.alpha
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8)
          ctx.restore()
        }
      }

      if (activeCount > 0) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animate()
  }

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  return (
    <div className="card paper-shredder-box" style={{ padding: '24px 20px', textAlign: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          📄 纸上情绪 · 具象解离
        </span>
        <button
          className="ghost"
          style={{ padding: '4px 10px', fontSize: 12, height: 'auto' }}
          onClick={() => onCalmed()}
        >
          好受些了
        </button>
      </div>

      {phase === 'flat' && (
        <div className="shred-stage">
          <div
            className={`paper-scrap crinkle-${crumpleProgress}`}
            onClick={handleTapPaper}
            title="点击揉皱"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleTapPaper()
            }}
          >
            <div className="paper-tape" />
            <p className="paper-text">{text || '说不出口的沉重与委屈'}</p>
            <span className="paper-hint">点击纸片或下方按钮开始揉皱</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="primary" onClick={handleCrumple}>
              揉成纸团
            </button>
          </div>
        </div>
      )}

      {phase === 'crumpled' && (
        <div className="shred-stage">
          <div className="paper-ball-container" onClick={startParticleExplosion}>
            <svg viewBox="-30 -30 60 60" width="84" height="84" className="paper-ball-svg">
              {/* 3D 纸团折痕 */}
              <polygon points="0,-24 16,-16 22,4 12,22 -8,20 -22,8 -18,-14" fill="#eee5d0" stroke="#d5c8ab" strokeWidth="1.2" />
              <polygon points="0,-24 16,-16 4,-2" fill="#ded3b9" opacity="0.8" />
              <polygon points="16,-16 22,4 6,10 4,-2" fill="#f8f2e2" />
              <polygon points="22,4 12,22 2,12 6,10" fill="#cfc2a3" />
              <polygon points="12,22 -8,20 -4,6 2,12" fill="#e6dcc6" />
              <polygon points="-8,20 -22,8 -8,-2 -4,6" fill="#ded2b7" />
              <polygon points="-22,8 -18,-14 -6,-8 -8,-2" fill="#ede4ce" />
              <polygon points="-18,-14 0,-24 4,-2 -6,-8" fill="#fcf6e8" />
              <polygon points="4,-2 6,10 2,12 -4,6 -8,-2 -6,-8" fill="#e2d6bc" opacity="0.9" />
            </svg>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 0' }}>已紧紧揉成一团，负重已锁定</p>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="primary" onClick={startParticleExplosion}>
              用力撕碎吹散
            </button>
          </div>
        </div>
      )}

      {phase === 'shredded' && (
        <div className="shred-stage" style={{ position: 'relative', minHeight: 180 }}>
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
          <div style={{ paddingTop: 60, position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🍃</div>
            <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, margin: '0 0 6px' }}>
              碎纸化作微尘散去，负重已不再心头
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>微风吹过，烦恼已随风化开</p>
          </div>
        </div>
      )}
    </div>
  )
}
