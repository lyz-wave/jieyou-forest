import { useMemo } from 'react'
import type { RingRow } from '../../shared/types'

/**
 * 年轮的两种类型。
 *
 * 颜色承载的是**用户自己做过的事实**——我留下的是"观察"还是"行动"——
 * 而不是系统对他内心的判断。
 *
 * 这里原本有三样东西，全删了：
 *
 * 1. `inferRingEmotion`：用关键词正则把每条年轮判成 anger / anxiety / sorrow /
 *    fatigue / calm，再上色、贴「激愤释放」「焦虑紧绷」这类标签，最后由
 *    ResilienceProfile 汇总成「你最经常转化的情绪基调」。
 *    三个问题：① 系统在替用户定义感受——「你当时是焦虑」就是诊断，PRD §8.1 明令禁止；
 *    ② 用的是正则，比模型更硬（"我今天一点都不焦虑了"会被判成焦虑）；
 *    ③ 界面上没有任何"这是推断"的标注，用户也无从否认。
 *
 * 2. `inferRingDomain`：把年轮归进职场/人际/自我/创意四格。同样是系统在替用户
 *    框定处境——"这件事算工作还是算关系"本身就是被强加的框架。
 *
 * 3. 这两套推断驱动的筛选与统计。现在筛选改成按**类型**——那是数据库里的字段，
 *    不需要推断，也不会误判。
 *
 * 一句话：**系统不判断用户的感受，也不替他分类处境。**
 */
export type RingTone = 'support' | 'action'

export interface RingTheme {
  label: string
  color: string
  fill: string
  glow: string
}

export const RING_THEMES: Record<RingTone, RingTheme> = {
  support: {
    label: '陪伴年轮',
    color: '#4b7b5e',
    fill: 'rgba(75, 123, 94, 0.22)',
    glow: 'rgba(75, 123, 94, 0.55)',
  },
  action: {
    label: '行动年轮',
    color: '#a9713f',
    fill: 'rgba(169, 113, 63, 0.22)',
    glow: 'rgba(169, 113, 63, 0.55)',
  },
}

/** 年轮类型是数据库里的字段，不是推断。 */
export function ringTone(ring: RingRow): RingTone {
  return ring.type === 'action' ? 'action' : 'support'
}

/** 筛选维度。只有"可核对的事实"，没有系统推断出来的分类。 */
export type RingTypeFilter = 'all' | RingTone

export const RING_TYPE_FILTERS: Array<{ id: RingTypeFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'support', label: '陪伴年轮' },
  { id: 'action', label: '行动年轮' },
]

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function getWobblePoints(
  cx: number,
  cy: number,
  baseRadius: number,
  seed: number,
  numPoints: number = 36,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  const phi1 = (seed % 100) * 0.1
  const phi2 = ((seed >> 2) % 100) * 0.1
  const phi3 = ((seed >> 4) % 100) * 0.1

  for (let i = 0; i < numPoints; i++) {
    const theta = (i * 2 * Math.PI) / numPoints
    const wobble =
      1.8 * Math.sin(3 * theta + phi1) +
      1.2 * Math.cos(5 * theta + phi2) +
      0.8 * Math.sin(7 * theta + phi3)
    const r = Math.max(10, baseRadius + wobble)
    points.push({
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
    })
  }
  return points
}

function pointsToSmoothPath(points: Array<{ x: number; y: number }>): string {
  const n = points.length
  if (n < 3) return ''

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  d += ' Z'
  return d
}

interface TrunkRingsDiscProps {
  rings: RingRow[]
  selectedRingId: string | null
  activeType: RingTypeFilter
  onSelectRing: (id: string) => void
}

export default function TrunkRingsDisc({
  rings,
  selectedRingId,
  activeType,
  onSelectRing,
}: TrunkRingsDiscProps) {
  const cx = 150
  const cy = 150
  const heartwoodR = 30
  const maxOuterR = 138

  // 年轮从内向外辐射：最早的年轮靠近髓心，最新的年轮在最外层
  const chronologicalRings = useMemo(() => [...rings].reverse(), [rings])

  const ringGeometries = useMemo(() => {
    const count = chronologicalRings.length
    if (count === 0) return []

    const step = (maxOuterR - heartwoodR) / Math.max(count, 1)

    return chronologicalRings.map((ring, idx) => {
      const baseR = heartwoodR + (idx + 0.8) * step
      const seed = hashString(ring.id || String(idx))
      const points = getWobblePoints(cx, cy, baseR, seed)
      const pathD = pointsToSmoothPath(points)
      const tone = ringTone(ring)
      const theme = RING_THEMES[tone]
      const isSelected = selectedRingId === ring.id
      const isDimmed = activeType !== 'all' && tone !== activeType

      return {
        ring,
        pathD,
        baseR,
        tone,
        theme,
        isSelected,
        isDimmed,
      }
    })
  }, [chronologicalRings, selectedRingId, activeType])

  return (
    <div className="trunk-disc-container">
      <svg
        className="trunk-disc-svg"
        viewBox="0 0 300 300"
        role="img"
        aria-label="木桩截面同心年轮盘"
      >
        <defs>
          <radialGradient id="barkGrad" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#d5c0a3" stopOpacity="0.4" />
            <stop offset="90%" stopColor="#bfa382" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#7a5f42" stopOpacity="0.95" />
          </radialGradient>
          <radialGradient id="heartwoodGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#543d2b" />
            <stop offset="70%" stopColor="#73563d" />
            <stop offset="100%" stopColor="#8c6b4e" />
          </radialGradient>
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 外层树皮截面底盘 */}
        <circle
          cx={cx}
          cy={cy}
          r={144}
          fill="url(#barkGrad)"
          stroke="#8c6c4c"
          strokeWidth="3.5"
          className="trunk-bark"
        />

        {/* 边材背景基质 */}
        <circle
          cx={cx}
          cy={cy}
          r={140}
          fill="rgba(247, 240, 227, 0.75)"
          className="trunk-sapwood"
        />

        {/* 同心年轮层渲染 */}
        {ringGeometries.map(({ ring, pathD, theme, isSelected, isDimmed }) => {
          const strokeWidth = ring.type === 'action' ? 9 : 5.5

          return (
            <g
              key={ring.id}
              className={`trunk-ring-group ${isSelected ? 'selected' : ''} ${
                isDimmed ? 'dimmed' : ''
              }`}
              onClick={() => onSelectRing(ring.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* 视觉年轮线 */}
              <path
                d={pathD}
                fill={isSelected ? theme.fill : 'none'}
                stroke={theme.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDimmed ? 0.2 : 0.88}
                filter={isSelected ? 'url(#ringGlow)' : undefined}
                className="trunk-ring-path"
                data-testid={`ring-path-${ring.id}`}
              />

              {/* 选中高亮外圈指示 */}
              {isSelected && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.9"
                  className="trunk-ring-select-dash"
                />
              )}

              {/* 命中检测辅助层（加宽透明点击区域，触控更友好） */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                className="trunk-ring-hitbox"
              />
            </g>
          )
        })}

        {/* 髓心核心（Heartwood） */}
        <circle
          cx={cx}
          cy={cy}
          r={heartwoodR}
          fill="url(#heartwoodGrad)"
          stroke="#422e1e"
          strokeWidth="2.5"
          className="trunk-heartwood"
        />
        {/* 髓心生长原点同心细纹 */}
        <circle cx={cx} cy={cy} r={heartwoodR * 0.55} fill="none" stroke="#5a422f" strokeWidth="1.2" opacity="0.6" />
        <circle cx={cx} cy={cy} r={heartwoodR * 0.25} fill="#3a2517" />

        {/* 髓心文字标签 */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill="#ecd5b9"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.04em"
          pointerEvents="none"
        >
          {rings.length > 0 ? `${rings.length} 圈` : '髓心'}
        </text>
      </svg>
    </div>
  )
}
