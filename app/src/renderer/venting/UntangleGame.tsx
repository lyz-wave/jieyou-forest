import { useState, useRef, useEffect, useCallback } from 'react'

export interface UntangleGameProps {
  onCalmed: () => void
}

interface Node {
  id: number
  x: number
  y: number
}

interface Edge {
  source: number
  target: number
}

// 预设的一套美观且易于理顺的图结构（5个节点，6条边）
const INITIAL_NODES: Node[] = [
  { id: 0, x: 80, y: 60 },
  { id: 1, x: 260, y: 180 },
  { id: 2, x: 70, y: 180 },
  { id: 3, x: 270, y: 60 },
  { id: 4, x: 170, y: 120 },
]

// 对应完全无相交的平面解坐标
const SOLVED_POSITIONS: Record<number, { x: number; y: number }> = {
  0: { x: 170, y: 35 },
  1: { x: 290, y: 110 },
  2: { x: 50, y: 110 },
  3: { x: 240, y: 205 },
  4: { x: 100, y: 205 },
}

const EDGES: Edge[] = [
  { source: 0, target: 1 },
  { source: 1, target: 3 },
  { source: 2, target: 3 },
  { source: 0, target: 2 },
  { source: 2, target: 4 },
  { source: 3, target: 4 },
]

function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
}

function doIntersect(p1: Node, p2: Node, p3: Node, p4: Node): boolean {
  if (
    p1.id === p3.id ||
    p1.id === p4.id ||
    p2.id === p3.id ||
    p2.id === p4.id
  ) {
    return false
  }
  return (
    ccw(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y) !==
      ccw(p2.x, p2.y, p3.x, p3.y, p4.x, p4.y) &&
    ccw(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y) !==
      ccw(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y)
  )
}

export default function UntangleGame({ onCalmed }: UntangleGameProps) {
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [hasSolved, setHasSolved] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // 空灵磬音合成
  const playChime = useCallback((frequency = 528) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(frequency, ctx.currentTime)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 1.2)
    } catch {
      // 静音降级
    }
  }, [])

  // 计算哪些线段有交叉
  const intersectingEdges = new Set<number>()
  let crossingCount = 0

  for (let i = 0; i < EDGES.length; i++) {
    for (let j = i + 1; j < EDGES.length; j++) {
      const e1 = EDGES[i]
      const e2 = EDGES[j]
      const n1 = nodes.find((n) => n.id === e1.source)!
      const n2 = nodes.find((n) => n.id === e1.target)!
      const n3 = nodes.find((n) => n.id === e2.source)!
      const n4 = nodes.find((n) => n.id === e2.target)!

      if (doIntersect(n1, n2, n3, n4)) {
        intersectingEdges.add(i)
        intersectingEdges.add(j)
        crossingCount++
      }
    }
  }

  // 判定是否成功理顺
  useEffect(() => {
    if (crossingCount === 0 && !hasSolved) {
      setHasSolved(true)
      playChime(660)
      const timer = setTimeout(() => {
        onCalmed()
      }, 700)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [crossingCount, hasSolved, onCalmed, playChime])

  const handlePointerDown = (id: number, e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDraggingId(id)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId === null || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    // SVG viewBox 340 x 240
    const scaleX = 340 / rect.width
    const scaleY = 240 / rect.height
    const clientX = Math.max(30, Math.min(310, (e.clientX - rect.left) * scaleX))
    const clientY = Math.max(30, Math.min(210, (e.clientY - rect.top) * scaleY))

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingId ? { ...n, x: Math.round(clientX), y: Math.round(clientY) } : n)),
    )
  }

  const handlePointerUp = () => {
    setDraggingId(null)
  }

  // 一键理顺（给不想操作的用户降压捷径）
  const handleSolve = () => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        x: SOLVED_POSITIONS[n.id].x,
        y: SOLVED_POSITIONS[n.id].y,
      })),
    )
  }

  // 理顺一步（逐渐平息）
  const handleStepAssist = () => {
    setNodes((prev) =>
      prev.map((n) => {
        const target = SOLVED_POSITIONS[n.id]
        return {
          ...n,
          x: Math.round(n.x + (target.x - n.x) * 0.5),
          y: Math.round(n.y + (target.y - n.y) * 0.5),
        }
      }),
    )
  }

  return (
    <div className="card untangle-game-box" style={{ padding: '22px 20px', textAlign: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          🌀 乱麻理顺 · 理清纠葛
        </span>
        <button
          className="ghost"
          style={{ padding: '4px 10px', fontSize: 12, height: 'auto' }}
          onClick={onCalmed}
        >
          好受些了
        </button>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
        拖动发光的圆点，让交织的红线分开。当没有线段交叉，心绪便清明了。
      </p>

      {/* 游戏主舞台 SVG */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 360,
          margin: '0 auto',
          touchAction: 'none',
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 340 240"
          className="untangle-svg"
          style={{
            width: '100%',
            height: 'auto',
            background: 'rgba(0, 0, 0, 0.02)',
            borderRadius: 16,
            border: '1px solid rgba(0, 0, 0, 0.05)',
            userSelect: 'none',
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* 连线 */}
          {EDGES.map((edge, idx) => {
            const n1 = nodes.find((n) => n.id === edge.source)!
            const n2 = nodes.find((n) => n.id === edge.target)!
            const isCrossed = intersectingEdges.has(idx)

            return (
              <line
                key={idx}
                x1={n1.x}
                y1={n1.y}
                x2={n2.x}
                y2={n2.y}
                stroke={isCrossed ? '#d96b43' : '#638b58'}
                strokeWidth={isCrossed ? 2.8 : 2}
                strokeDasharray={isCrossed ? '6 4' : 'none'}
                opacity={isCrossed ? 0.9 : 0.75}
                style={{
                  transition: draggingId !== null ? 'none' : 'all 0.35s ease',
                  filter: isCrossed ? 'drop-shadow(0 0 4px rgba(217, 107, 67, 0.4))' : 'none',
                }}
              />
            )
          })}

          {/* 节点 */}
          {nodes.map((node) => {
            const isDragging = draggingId === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onPointerDown={(e) => handlePointerDown(node.id, e)}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {/* 光晕外圈 */}
                <circle
                  r={isDragging ? 20 : 15}
                  fill="rgba(255, 255, 255, 0.85)"
                  stroke={crossingCount === 0 ? '#638b58' : '#3d5735'}
                  strokeWidth={2}
                  style={{
                    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.15))',
                    transition: 'r 0.15s ease',
                  }}
                />
                {/* 核心玉质光点 */}
                <circle
                  r={isDragging ? 8 : 6}
                  fill={crossingCount === 0 ? '#638b58' : '#4a6f42'}
                />
              </g>
            )
          })}
        </svg>

        {/* 状态徽标 */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <span
            className="chip"
            style={{
              fontSize: 12,
              background: crossingCount === 0 ? 'rgba(99, 139, 88, 0.15)' : 'rgba(217, 107, 67, 0.12)',
              color: crossingCount === 0 ? '#385e30' : '#a84e2a',
              fontWeight: 600,
            }}
          >
            {crossingCount === 0 ? '✨ 乱麻理顺 · 心境通达' : `缠结点：${crossingCount} 处`}
          </span>
        </div>
      </div>

      {/* 辅助按钮组 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
        {crossingCount > 0 && (
          <>
            <button className="ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={handleStepAssist}>
              理顺一步
            </button>
            <button className="ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={handleSolve}>
              一键理顺
            </button>
          </>
        )}
        <button className="primary" style={{ fontSize: 13, padding: '5px 14px' }} onClick={onCalmed}>
          心里好受些了
        </button>
      </div>
    </div>
  )
}
