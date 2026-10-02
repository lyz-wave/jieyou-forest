import { useMemo } from 'react'
import type { RingRow } from '../../shared/types'

export type EmotionTone = 'anxiety' | 'sorrow' | 'anger' | 'fatigue' | 'calm' | 'default'

export interface EmotionTheme {
  label: string
  color: string
  fill: string
  glow: string
}

export const EMOTION_THEMES: Record<EmotionTone, EmotionTheme> = {
  anger: {
    label: '激愤释放',
    color: '#d9643a',
    fill: 'rgba(217, 100, 58, 0.22)',
    glow: 'rgba(217, 100, 58, 0.55)',
  },
  anxiety: {
    label: '焦虑紧绷',
    color: '#e5a024',
    fill: 'rgba(229, 160, 36, 0.22)',
    glow: 'rgba(229, 160, 36, 0.55)',
  },
  sorrow: {
    label: '悲伤委屈',
    color: '#4b6584',
    fill: 'rgba(75, 101, 132, 0.22)',
    glow: 'rgba(75, 101, 132, 0.55)',
  },
  fatigue: {
    label: '疲惫消耗',
    color: '#8c7b6c',
    fill: 'rgba(140, 123, 108, 0.22)',
    glow: 'rgba(140, 123, 108, 0.55)',
  },
  calm: {
    label: '宁静释然',
    color: '#4b7b5e',
    fill: 'rgba(75, 123, 94, 0.22)',
    glow: 'rgba(75, 123, 94, 0.55)',
  },
  default: {
    label: '温润原木',
    color: '#8a7258',
    fill: 'rgba(138, 114, 88, 0.22)',
    glow: 'rgba(138, 114, 88, 0.5)',
  },
}

export type DomainCategory = 'all' | 'work' | 'relationship' | 'self' | 'creative'

export const DOMAIN_CATEGORIES: Array<{ id: DomainCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'work', label: '职场工作' },
  { id: 'relationship', label: '人际亲密' },
  { id: 'self', label: '自我认同' },
  { id: 'creative', label: '创意探索' },
]

export function inferRingEmotion(ring: RingRow): EmotionTone {
  const text = `${ring.user_note} ${ring.original_text ?? ''} ${ring.user_decision ?? ''}`
  if (/生气|愤怒|火大|气愤|暴躁|抓狂|怒/.test(text)) return 'anger'
  if (/焦虑|慌|担心|急|压力|害怕|失控|紧绷/.test(text)) return 'anxiety'
  if (/难过|伤心|委屈|哭|痛苦|遗憾|失落|被拒|否定/.test(text)) return 'sorrow'
  if (/疲惫|累|消耗|精疲力竭|困|倦/.test(text)) return 'fatigue'
  if (/平静|释然|安稳|松弛|轻松|接纳/.test(text)) return 'calm'
  return 'default'
}

export function inferRingDomain(ring: RingRow): DomainCategory {
  const text = `${ring.user_note} ${ring.original_text ?? ''} ${ring.action ?? ''}`
  if (/工作|职场|方案|导师|老板|同事|领导|会议|汇报|加班|业绩|指标|面试|公司|离职|入职/.test(text)) return 'work'
  if (/朋友|伴侣|父母|感情|亲密|吵架|沟通|爸|妈|恋人|家人|恋爱|相处|她|他/.test(text)) return 'relationship'
  if (/创作|灵感|写|画|设计|代码|比赛|艺术|故事|创意|文章|项目/.test(text)) return 'creative'
  return 'self'
}

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
  activeCategory: DomainCategory
  onSelectRing: (id: string) => void
}

export default function TrunkRingsDisc({
  rings,
  selectedRingId,
  activeCategory,
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
      const tone = inferRingEmotion(ring)
      const theme = EMOTION_THEMES[tone]
      const domain = inferRingDomain(ring)
      const isSelected = selectedRingId === ring.id
      const isDimmed = activeCategory !== 'all' && domain !== activeCategory

      return {
        ring,
        pathD,
        baseR,
        tone,
        theme,
        domain,
        isSelected,
        isDimmed,
      }
    })
  }, [chronologicalRings, selectedRingId, activeCategory])

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
