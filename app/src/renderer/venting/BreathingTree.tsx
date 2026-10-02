import { useState, useRef, useEffect, useCallback } from 'react'

export interface BreathingTreeProps {
  onCalmed: () => void
}

type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest'

interface FallingLeaf {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  vAngle: number
  size: number
  color: string
}

export default function BreathingTree({ onCalmed }: BreathingTreeProps) {
  const [growthLevel, setGrowthLevel] = useState(1) // 1 到 5
  const [phase, setPhase] = useState<BreathPhase>('inhale')
  const [countdown, setCountdown] = useState(4)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number | null>(null)
  const leavesRef = useRef<FallingLeaf[]>([])

  // 呼吸引导时钟 (4s 吸气 -> 2s 屏息 -> 4s 呼气 -> 1s 停顿)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c > 1) return c - 1

        if (phase === 'inhale') {
          setPhase('hold')
          return 2
        } else if (phase === 'hold') {
          setPhase('exhale')
          return 4
        } else if (phase === 'exhale') {
          setPhase('rest')
          // 呼气完成一次，生长一级
          setGrowthLevel((lvl) => {
            const next = Math.min(5, lvl + 1)
            if (next === 5) {
              onCalmed()
            }
            return next
          })
          return 1
        } else {
          setPhase('inhale')
          return 4
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [phase, onCalmed])

  // Canvas 分形树与落叶动画
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)

    // 递归绘制分形树枝
    const drawBranch = (
      startX: number,
      startY: number,
      len: number,
      angle: number,
      branchWidth: number,
      depth: number,
    ) => {
      ctx.beginPath()
      ctx.save()
      ctx.strokeStyle = depth > 3 ? '#5c4533' : '#423122'
      ctx.lineWidth = branchWidth
      ctx.lineCap = 'round'
      ctx.translate(startX, startY)
      ctx.rotate((angle * Math.PI) / 180)
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -len)
      ctx.stroke()

      if (depth < growthLevel) {
        // 左分支
        drawBranch(0, -len, len * 0.74, -22, branchWidth * 0.68, depth + 1)
        // 右分支
        drawBranch(0, -len, len * 0.74, 22, branchWidth * 0.68, depth + 1)
        // 中间嫩芽
        if (depth >= 2) {
          drawBranch(0, -len * 0.8, len * 0.45, 6, branchWidth * 0.5, depth + 1)
        }
      } else {
        // 枝头嫩叶与繁花
        ctx.beginPath()
        ctx.arc(0, -len, depth >= 4 ? 4.5 : 3, 0, Math.PI * 2)
        ctx.fillStyle = depth >= 4 ? '#f7a8b8' : '#729864' // 顶级开出粉色小花，平时嫩绿
        ctx.fill()
      }

      ctx.restore()
    }

    // 主树干
    const trunkLen = 42 + growthLevel * 5
    drawBranch(width / 2, height - 15, trunkLen, 0, 7.5, 0)

    // 绘制随风摇曳的落叶
    const leaves = leavesRef.current
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]
      leaf.x += leaf.vx
      leaf.y += leaf.vy
      leaf.angle += leaf.vAngle

      if (leaf.y > height) {
        leaf.y = -10
        leaf.x = Math.random() * width
      }

      ctx.save()
      ctx.translate(leaf.x, leaf.y)
      ctx.rotate(leaf.angle)
      ctx.fillStyle = leaf.color
      ctx.beginPath()
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    animRef.current = requestAnimationFrame(renderCanvas)
  }, [growthLevel])

  // 初始化落叶粒子池
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.parentElement?.clientWidth || 340
    canvas.height = 200

    const initialLeaves: FallingLeaf[] = []
    const leafColors = ['#8ca87e', '#a3be95', '#d4a373', '#e9c46a']
    for (let i = 0; i < 14; i++) {
      initialLeaves.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: Math.random() * 0.7 + 0.4,
        angle: Math.random() * Math.PI,
        vAngle: (Math.random() - 0.5) * 0.04,
        size: Math.random() * 4 + 3,
        color: leafColors[Math.floor(Math.random() * leafColors.length)],
      })
    }
    leavesRef.current = initialLeaves

    animRef.current = requestAnimationFrame(renderCanvas)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [renderCanvas])

  const phaseNames: Record<BreathPhase, string> = {
    inhale: '吸气 · 纳新',
    hold: '屏息 · 宁息',
    exhale: '呼气 · 释放',
    rest: '停顿 · 归位',
  }

  return (
    <div className="card breathing-tree-box" style={{ padding: '22px 20px', textAlign: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          🌿 呼吸萌芽 · 伴树生长
        </span>
        <button
          className="ghost"
          style={{ padding: '4px 10px', fontSize: 12, height: 'auto' }}
          onClick={onCalmed}
        >
          好受些了
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
        跟随光晕呼纳气息。每次呼出杂念，树便抽出一缕新枝。
      </p>

      {/* 呼吸引导光球 */}
      <div style={{ margin: '10px 0 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background:
              phase === 'inhale'
                ? 'radial-gradient(circle, #89b37c 0%, #567e49 100%)'
                : phase === 'exhale'
                ? 'radial-gradient(circle, #d9be94 0%, #aa8b60 100%)'
                : 'radial-gradient(circle, #7ca189 0%, #466e53 100%)',
            transform: phase === 'inhale' ? 'scale(1.3)' : phase === 'exhale' ? 'scale(0.85)' : 'scale(1.1)',
            transition: phase === 'inhale' ? 'transform 4s ease-out' : phase === 'exhale' ? 'transform 4s ease-in' : 'transform 1s ease',
            boxShadow: '0 0 16px rgba(114, 152, 100, 0.45)',
          }}
        />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#3d5735' }}>{phaseNames[phase]}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{countdown} 秒</div>
        </div>
      </div>

      {/* Canvas 树木舞台 */}
      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 14,
            background: 'rgba(0, 0, 0, 0.02)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
          }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <span
          className="chip"
          style={{
            fontSize: 12,
            background: growthLevel >= 5 ? 'rgba(99, 139, 88, 0.16)' : 'rgba(0,0,0,0.06)',
            color: growthLevel >= 5 ? '#385e30' : 'var(--muted)',
            fontWeight: 600,
          }}
        >
          繁茂度：{growthLevel} / 5 层 {growthLevel >= 5 ? '（枝头初绽新花）' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
        <button
          className="ghost"
          style={{ fontSize: 13, padding: '5px 12px' }}
          onClick={() => {
            setGrowthLevel((lvl) => {
              const next = Math.min(5, lvl + 1)
              if (next === 5) onCalmed()
              return next
            })
          }}
        >
          深呼吸萌芽 (+1层)
        </button>
        <button className="primary" style={{ fontSize: 13, padding: '5px 16px' }} onClick={onCalmed}>
          心里好受些了
        </button>
      </div>
    </div>
  )
}
