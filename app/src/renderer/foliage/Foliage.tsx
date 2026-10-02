/**
 * 柔焦叶影。它唯一的作用是给玻璃提供"可被糊开的形状"：
 * 背景若只有平滑渐变与噪点，磨砂玻璃糊完之后与半透明色块没有区别。
 * 纯装饰，不承载任何信息。
 */
const LEAVES = [
  { x: 6, y: 16, s: 1.6, r: -18, o: 0.62 },
  { x: 82, y: 11, s: 1.15, r: 26, o: 0.5 },
  { x: 26, y: 60, s: 2.0, r: 8, o: 0.42 },
  { x: 92, y: 57, s: 1.5, r: -34, o: 0.52 },
  { x: 55, y: 88, s: 1.7, r: 14, o: 0.4 },
  { x: 12, y: 90, s: 1.05, r: -8, o: 0.46 },
  { x: 68, y: 33, s: 0.95, r: 42, o: 0.34 },
  { x: 40, y: 22, s: 0.8, r: -52, o: 0.3 },
]

const LEAF_PATH = 'M 0 0 C 6 -9.5 18 -11 24.5 -2.2 C 17.5 7.4 6 8.6 0 0 Z'

export default function Foliage() {
  return (
    <svg
      className="foliage"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="#2f5a34">
        {LEAVES.map((l, i) => (
          <g key={i} transform={'translate(' + l.x + ' ' + l.y + ') rotate(' + l.r + ') scale(' + l.s + ')'} opacity={l.o}>
            <path d={LEAF_PATH} />
            <path d="M 1.5 -0.6 L 22 -1.4" stroke="#1f4326" strokeWidth="0.7" opacity="0.5" />
          </g>
        ))}
      </g>
    </svg>
  )
}
