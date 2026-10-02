import { useMemo } from 'react'
import { ANIMALS, Silhouette, type AnimalId } from './silhouettes'
import './AnimalTroupe.css'

/**
 * 八只动物所在的场景层。
 *
 * 它按**你的状态**分层（这是这套设计里最要紧的一条）：
 *
 *   idle    首页空闲      各自游走、偶尔互相看一眼
 *   quiet   **你一开始输入**  安静下来，只保留呼吸/摆尾这类微动
 *   gather  点了「开始对话」  聚拢过来，围成一圈听你说
 *   await   承接之后       聚拢着等你点头
 *   discuss 讨论中         谁说话谁被高亮，其余在听
 *
 * **活物是背景，不是控件。** 你一动手它们就安静——这一条让"八只动物"和
 * "首页只剩一句话一个输入框"这两件事不必二选一。
 *
 * ## 为什么每只动物是一个 HTML 元素，而不是同一个 SVG 里的 `<g>`
 *
 * 先说清楚：**这一条没有实测支撑，是拿不准时的保守选择。**
 *
 * 起因是我一度测到帧率在 24–56 之间跳，据此判断"SVG 子元素的 transform
 * 拿不到独立合成层、每帧要重绘整个 SVG"，于是改成一层一只。
 * 但后来查明**那次测量是被污染的**：我自己残留的 Electron 辅助进程在烧
 * 120% CPU、系统负载 22。清干净之后重测，**两种写法都是稳定的 60fps**。
 *
 * 所以现在留着它只是因为：给多个独立动来动去的对象各分一层，是更常见也更稳的做法，
 * 在机器被别的程序占满时退化得更慢。**不要把它当成"实测的优化"来引用。**
 *
 * ⚠️ 顺便记一条测量卫生：**测帧率之前先确认没有残留进程**。
 *    `pgrep -f "out/main/index.js"` 为 0 不代表干净——主进程退出后，
 *    渲染/GPU 辅助进程可能变成孤儿继续空转。
 *
 * 附带的好处：「减少动画」不必额外处理，底部那条 @media 一把关掉即可。
 */
export type TroupeMode = 'idle' | 'quiet' | 'gather' | 'await' | 'discuss'

/** 世界坐标：1000 × 700，屏幕上用 --u = 100vw / 1000 换算。 */
const GROUND_Y = 520
const WORLD_W = 1000
/** 剪影单位 → 世界单位（最远那只的基准）。越近乘得越大。 */
const SCALE = 2.15

interface Slot {
  x: number
  y: number
  scale: number
  gatherX: number
  gatherY: number
  delay: number
  depth: number
}

function layout(): Record<AnimalId, Slot> {
  const out = {} as Record<AnimalId, Slot>
  const n = ANIMALS.length
  ANIMALS.forEach((a, i) => {
    const t = n > 1 ? i / (n - 1) : 0.5
    // 两端各留 190 世界单位：剪影最宽的那只横向半径约 130，
    // 留 90 会让最左边那只被切出画面（实测过 left: -17）。
    const x = 190 + t * (WORLD_W - 380)

    // **纵深是让八只放得下的唯一办法。**
    // 每只约 250px 宽，八只排成一排要 2000px，而画面只有 1180px——
    // 同一水平线上必然重叠（实测有两对明显撞在一起，视觉模型只数出 6 只）。
    // 拉开远近之后，重叠读作"错落"。用 (i*3)%8 把远近打散，
    // 避免从左到右形成一条由远及近的斜坡。
    const depth = ((i * 3) % n) / (n - 1) // 0..1
    const y = GROUND_Y - 46 + depth * 78
    const scale = SCALE * (0.74 + depth * 0.46)
    // gather：以画面中心为圆心的半弧，两端略靠后
    const ang = Math.PI * (0.12 + 0.76 * (1 - t))
    const rad = 210
    out[a.id] = {
      x,
      y,
      scale,
      gatherX: WORLD_W / 2 + Math.cos(ang) * rad * 1.25,
      gatherY: GROUND_Y + 6 + Math.sin(ang) * 46,
      delay: (i % 4) * 0.6,
      depth,
    }
  })
  return out
}

/** 绘制顺序：远的先画，近的压在上面。顺序错了纵深立刻穿帮。 */
function byDepth(): AnimalId[] {
  const n = ANIMALS.length
  return [...ANIMALS]
    .map((a, i) => ({ id: a.id, d: ((i * 3) % n) / (n - 1) }))
    .sort((p, q) => p.d - q.d)
    .map((p) => p.id)
}

export default function AnimalTroupe({
  mode,
  speakingId,
}: {
  mode: TroupeMode
  /** discuss 模式下正在发言的那只 */
  speakingId?: AnimalId | null
}) {
  const cluster = mode === 'gather' || mode === 'await' || mode === 'discuss'
  const slots = useMemo(layout, [])
  const order = useMemo(byDepth, [])
  const sorted = useMemo(
    () => [...ANIMALS].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
    [order],
  )

  return (
    <div className={`animal-troupe animal-troupe--${mode}`} aria-hidden="true" style={{ '--u': 'calc(100vw / ' + WORLD_W + ')' } as React.CSSProperties}>
      {cluster && (
        <div
          className="animal-campfire"
          style={{
            position: 'absolute',
            left: `calc(var(--u) * ${WORLD_W / 2 - 35})`,
            top: `calc(var(--u) * ${GROUND_Y + 8})`,
            width: 'calc(var(--u) * 70)',
            height: 'calc(var(--u) * 60)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <svg viewBox="0 0 70 60" width="100%" height="100%">
            <path d="M15 48 L55 54 M55 48 L15 54" stroke="#4a3020" strokeWidth="6" strokeLinecap="round" />
            <path d="M22 46 L48 46" stroke="#684228" strokeWidth="5" strokeLinecap="round" />
            <path d="M35 12 C24 26 18 38 20 48 C22 54 28 56 35 56 C42 56 48 54 50 48 C52 38 46 26 35 12 Z" fill="#d95328">
              <animateTransform attributeName="transform" type="scale" values="1 1; 1.06 0.95; 0.96 1.05; 1 1" dur="1.2s" repeatCount="indefinite" />
            </path>
            <path d="M35 22 C28 32 24 40 26 48 C28 52 31 54 35 54 C39 54 42 52 44 48 C46 40 42 32 35 22 Z" fill="#f6a032">
              <animateTransform attributeName="transform" type="scale" values="1 1; 0.94 1.08; 1.05 0.94; 1 1" dur="0.9s" repeatCount="indefinite" />
            </path>
            <path d="M35 34 C31 40 30 44 31 48 C32 50 33 51 35 51 C37 51 38 50 39 48 C40 44 39 40 35 34 Z" fill="#fff3cb" />
            <circle cx="33" cy="18" r="1.2" fill="#ffd978">
              <animate attributeName="cy" values="18;-6" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="39" cy="12" r="1" fill="#ffd978">
              <animate attributeName="cy" values="12;-12" dur="1.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0" dur="1.3s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      )}
      {sorted.map((a) => {
        const s = slots[a.id]
        const scale = cluster ? s.scale * 0.96 : s.scale
        const size = 100 * scale // 剪影画在 0..100 的方框里
        const cx = cluster ? s.gatherX : s.x
        const cy = cluster ? s.gatherY : s.y
        const speaking = mode === 'discuss' && speakingId === a.id
        return (
          <div
            key={a.id}
            className={`animal-slot${speaking ? ' is-speaking' : ''}`}
            data-animal={a.id}
            style={
              {
                '--delay': s.delay + 's',
                width: `calc(var(--u) * ${size})`,
                height: `calc(var(--u) * ${size})`,
                transform: `translate(calc(var(--u) * ${(cx - size / 2).toFixed(1)}), calc(var(--u) * ${(cy - size).toFixed(1)}))`,
              } as React.CSSProperties
            }
          >
            <div className="animal-wander">
              <div className="animal-breathe">
                <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }}>
                  <Silhouette id={a.id} color={a.color} accent="rgba(247, 240, 227, 0.92)" />
                </svg>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
