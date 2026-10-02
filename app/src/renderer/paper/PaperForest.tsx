import { useEffect, useRef, useState, useCallback } from 'react'
import paperGrainUrl from './paper-grain.png'
import './PaperForest.css'

interface PaperForestProps {
  initialNight?: boolean
  onToggleNight?: (isNight: boolean) => void
  showControls?: boolean
  /** 外部触发重剪：数值变化即重新下剪一次。用于把控件搬进设置后仍能触发。 */
  recutSignal?: number
}

// 纯函数 Mulberry32 伪随机种子生成器
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function PaperForest({
  initialNight = false,
  onToggleNight,
  showControls = true,
  recutSignal,
}: PaperForestProps) {
  const [isNight, setIsNight] = useState(initialNight)

  // 这个 prop 是受控的：设置里的开关改了它，舞台必须跟着变。
  // 原来只当成初始值（useState(initialNight)），挂载之后再改 prop 完全没反应——
  // 控件搬进设置之后，昼夜开关就变成了一个点了不动的按钮。
  useEffect(() => {
    setIsNight(initialNight)
  }, [initialNight])
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tagWrapRef = useRef<HTMLDivElement>(null)
  const foxBtnRef = useRef<HTMLButtonElement>(null)
  const leavesRef = useRef<HTMLDivElement>(null)

  /**
   * 系统的"减少动画"开关。
   *
   * 此前只有两条 CSS 规则生效（剪纸入场与吊挂摆动），而 RAF 主循环驱动的
   * 视差、落叶、狐狸跳跃、夜间飞虫照旧在跑——这违反 PRD F04 与票 #12 的验收。
   * 这里把"动的来源"逐一切断，而不是去重写那个 1600 行的循环。
   */
  const reducedRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedRef.current = mq.matches
    const onChange = (): void => {
      reducedRef.current = mq.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // 内部动画和渲染状态存储
  const stateRef = useRef<{
    seed: number
    R: () => number
    W: number
    H: number
    M: number
    U: number
    S: number
    portrait: boolean
    groundAt: (x: number) => number
    fox: {
      fx: number
      x: number
      y: number
      dir: number
      s: number
      sx: number
      sy: number
      hop: null | { t: number; x0: number; x1: number; dur: number; hgt: number; landed?: boolean }
    }
    puffs: Array<{ el: SVGElement; x: number; y: number; vx: number; vy: number; r: number; t: number }>
    leaves: Array<{
      el: HTMLElement
      on: boolean
      x: number
      y: number
      vx: number
      vy: number
      rot: number
      vr: number
      ph: number
      sz: number
      ambient: boolean
    }>
    flies: Array<{ x: number; y: number; a: number; sp: number; ph: number; bl: number; z: number }>
    flySprite: HTMLCanvasElement | null
    nightAmt: number
    ptr: { x: number; y: number; t: number }
    px: number
    py: number
    tx: number
    ty: number
    lastInput: number
    tagA: number
    tagV: number
    lastPX: number | null
    lastPT: number
    drag: null | { x: number; y: number; tx: number; ty: number }
    grainUrl: string | null
    rafId: number
    clock: number
    lastTime: number
    layersCache: Array<{ el: HTMLElement; f: number }>
    lastRenderPx: number
    lastRenderPy: number
  }>({
    seed: 1847,
    R: mulberry32(1847),
    W: 800,
    H: 600,
    M: 30,
    U: 8,
    S: 25,
    portrait: false,
    groundAt: () => 500,
    fox: { fx: 0.46, x: 0, y: 0, dir: 1, s: 1, sx: 1, sy: 1, hop: null },
    puffs: [],
    leaves: [],
    flies: [],
    flySprite: null,
    nightAmt: initialNight ? 1 : 0,
    ptr: { x: -9999, y: -9999, t: 0 },
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    lastInput: -1e9,
    tagA: -2.5,
    tagV: 0,
    lastPX: null,
    lastPT: 0,
    drag: null,
    grainUrl: null,
    rafId: 0,
    clock: 0,
    lastTime: 0,
    layersCache: [],
    lastRenderPx: -9999,
    lastRenderPy: -9999,
  })



  // 重新构建整个纸艺几何模型 (Mulberry32 PRNG + Scissor-cut)
  const build = useCallback(() => {
    const s = stateRef.current
    s.R = mulberry32(s.seed)
    const R = s.R
    const rr = (a: number, b: number) => a + (b - a) * R()
    const q = (n: number) => Math.round(n * 10) / 10
    const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

    const stage = stageRef.current
    if (!stage) return

    s.W = Math.max(320, typeof window !== 'undefined' ? window.innerWidth : 800)
    s.H = Math.max(420, typeof window !== 'undefined' ? window.innerHeight : 600)
    s.portrait = s.H > s.W * 1.08
    s.U = Math.sqrt(s.W * s.H) / 100
    s.S = Math.min(s.W, s.H) * 0.042
    s.M = Math.ceil(s.S * 1.35 + 14)

    const { W, H, M, U, portrait } = s
    const lw = W + 2 * M
    const lh = H + 2 * M

    // 辅助几何算法
    function area(p: number[][]) {
      let a = 0
      for (let i = 0; i < p.length; i++) {
        const u = p[i]
        const v = p[(i + 1) % p.length]
        a += u[0] * v[1] - v[0] * u[1]
      }
      return a
    }
    function orient(p: number[][]) {
      return area(p) < 0 ? p.slice().reverse() : p
    }
    function trace(p: number[][], j = 0.7, step = 7) {
      let str = ''
      const n = p.length
      for (let i = 0; i < n; i++) {
        const a = p[i]
        const b = p[(i + 1) % n]
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const L = Math.hypot(dx, dy) || 1
        const k = Math.max(1, Math.round(L / step))
        const nx = -dy / L
        const ny = dx / L
        for (let t = 0; t < k; t++) {
          let x = a[0] + (dx * t) / k
          let y = a[1] + (dy * t) / k
          if (t > 0) {
            const o = (R() - 0.5) * 2 * j
            x += nx * o
            y += ny * o
          }
          str += (str ? 'L' : 'M') + q(x) + ' ' + q(y)
        }
      }
      return str + 'Z'
    }
    const cut = (p: number[][], j = 0.7, step = 7) => trace(orient(p), j, step)
    const hole = (p: number[][], j = 0.7, step = 7) => trace(orient(p).slice().reverse(), j, step)
    function poly(p: number[][]) {
      const op = orient(p)
      let str = 'M' + q(op[0][0]) + ' ' + q(op[0][1])
      for (let i = 1; i < op.length; i++) str += 'L' + q(op[i][0]) + ' ' + q(op[i][1])
      return str + 'Z'
    }
    function circ(cx: number, cy: number, r: number, n?: number) {
      const p: number[][] = []
      n = n || Math.max(8, Math.round(r * 1.4))
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
      }
      return p
    }
    function wave(base: number, amps: number[], lens: number[]) {
      const ph = amps.map(() => R() * Math.PI * 2)
      return (x: number) => {
        let y = base
        for (let i = 0; i < amps.length; i++) y += amps[i] * Math.sin((x / lens[i]) * Math.PI * 2 + ph[i])
        return y
      }
    }
    function ridge(fn: (x: number) => number, bottom: number, step = 9, j = 0.9) {
      const p: number[][] = []
      for (let x = -M; x <= W + M + step; x += step) p.push([x, fn(x) + (R() - 0.5) * 2 * j])
      p.push([W + M + step, bottom], [-M, bottom])
      return poly(p)
    }

    function pine(cx: number, by: number, h: number, w: number) {
      const n = h > 420 ? 9 : h > 160 ? 7 : h > 70 ? 5 : h > 32 ? 4 : 3
      const trunkH = h * 0.09
      const crown = h - trunkH
      const tip = by - h
      const st = crown / (n + 0.45)
      const j = Math.max(0.45, h / 520)
      const step = Math.max(5, h / 70)
      const lean = (R() - 0.5) * w * 0.12
      let d = ''
      for (let i = 0; i < n; i++) {
        const top = tip + i * st
        const bot = tip + (i + 1.45) * st
        const k = (i + 1) / n
        const base = w * 0.5 * (0.26 + 0.74 * Math.pow(k, 0.9))
        const hr = base * (1 + (R() - 0.5) * 0.16)
        const hl = base * (1 + (R() - 0.5) * 0.16)
        const droop = st * 0.14
        const cx0 = cx + lean * (1 - k)
        d += cut(
          [
            [cx0, top],
            [cx + hr, bot + (R() - 0.5) * droop],
            [cx + hr * 0.5, bot - st * 0.28],
            [cx, bot - st * 0.18],
            [cx - hl * 0.5, bot - st * 0.28],
            [cx - hl, bot + (R() - 0.5) * droop],
          ],
          j,
          step,
        )
      }
      const tw = Math.max(1.4, w * 0.055)
      d += cut(
        [
          [cx - tw, by + 4],
          [cx - tw * 0.75, by - trunkH - st * 0.6],
          [cx + tw * 0.75, by - trunkH - st * 0.6],
          [cx + tw, by + 4],
        ],
        0.3,
        8,
      )
      return d
    }

    function blade(bx: number, by: number, h: number, lean: number, wb: number) {
      const L: number[][] = []
      const Rt: number[][] = []
      for (let i = 0; i <= 6; i++) {
        const t = i / 6
        const x = bx + lean * t * t
        const y = by - h * t
        const hw = wb * 0.5 * (1 - t) * (1 - t * 0.15)
        L.push([x - hw, y])
        if (i < 6) Rt.push([x + hw, y])
      }
      return poly(L.concat(Rt.reverse()))
    }

    function bankFn(xa: number, xb: number, yEdge: number, wob: (x: number) => number) {
      return (x: number) => {
        const sm = clamp((x - xa) / (xb - xa), 0, 1)
        return yEdge + wob(x) + Math.pow(sm, 3) * (H + M - yEdge) * 1.02
      }
    }

    function bankPath(fn: (x: number) => number, x0: number, x1: number) {
      const p: number[][] = []
      const st = x1 > x0 ? 9 : -9
      for (let x = x0; st > 0 ? x <= x1 : x >= x1; x += st) {
        p.push([x, Math.min(H + M, fn(x)) + (R() - 0.5) * 1.6])
      }
      p.push([x1, H + M], [x0, H + M])
      return poly(p)
    }

    function mushroom(cx: number, by: number, sz: number) {
      const tilt = (R() - 0.5) * sz * 0.3
      const capY = by - sz * 0.86
      const rx = sz * (0.46 + R() * 0.16)
      const ry = sz * (0.34 + R() * 0.12)
      const stem = cut(
        [
          [cx - sz * 0.17, by + 2],
          [cx - sz * 0.11 + tilt * 0.6, capY + sz * 0.05],
          [cx + sz * 0.11 + tilt * 0.6, capY + sz * 0.05],
          [cx + sz * 0.19, by + 2],
        ],
        0.35,
        4,
      )
      const cp: number[][] = []
      for (let i = 0; i <= 14; i++) {
        const a = Math.PI + (i / 14) * Math.PI
        cp.push([cx + tilt + Math.cos(a) * rx, capY + Math.sin(a) * ry])
      }
      cp.push([cx + tilt + rx * 0.7, capY + ry * 0.2], [cx + tilt, capY + ry * 0.28], [cx + tilt - rx * 0.7, capY + ry * 0.2])
      const cap = cut(cp, 0.4, 4)
      let dots = ''
      const nd = 2 + Math.floor(R() * 3)
      for (let i = 0; i < nd; i++) {
        const a = Math.PI * (1.15 + R() * 0.7)
        const rr2 = R() * 0.55 + 0.25
        dots += cut(circ(cx + tilt + Math.cos(a) * rx * rr2, capY + Math.sin(a) * ry * rr2 * 0.9, sz * (0.05 + R() * 0.05), 7), 0.2, 3)
      }
      return { stem, cap, dots }
    }

    function fern(bx: number, by: number, len: number, dir: number) {
      let d = ''
      const tipX = bx + dir * len * 0.62
      const tipY = by - len * 0.86
      const cx = bx + dir * len * 0.02
      const cy = by - len * 0.78
      const P = (t: number) => [
        (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * tipX,
        (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * tipY,
      ]
      const sp: number[][] = []
      const sp2: number[][] = []
      for (let i = 0; i <= 10; i++) {
        const t = i / 10
        const [x, y] = P(t)
        const w = 1.8 * (1 - t) + 0.4
        sp.push([x - w, y])
        sp2.push([x + w, y])
      }
      d += poly(sp.concat(sp2.reverse()))
      for (let t = 0.1; t < 0.97; t += 0.075) {
        const [x, y] = P(t)
        const [x2, y2] = P(Math.min(1, t + 0.01))
        const ta = Math.atan2(y2 - y, x2 - x)
        const L = len * 0.26 * (1 - t * 0.78)
        for (const side of [-1, 1]) {
          const a = ta + side * 1.05
          const ex = x + Math.cos(a) * L
          const ey = y + Math.sin(a) * L
          const mx = x + Math.cos(a) * L * 0.5
          const my = y + Math.sin(a) * L * 0.5
          const wd = L * 0.2
          d += cut(
            [
              [x, y],
              [mx + Math.cos(a + Math.PI / 2) * wd, my + Math.sin(a + Math.PI / 2) * wd],
              [ex, ey],
              [mx - Math.cos(a + Math.PI / 2) * wd, my - Math.sin(a + Math.PI / 2) * wd],
            ],
            0.25,
            4,
          )
        }
      }
      return d
    }

    function foxglove(bx: number, by: number, h: number, lean: number, side: number) {
      let stalk = ''
      let bells = ''
      let inner = ''
      const P = (t: number) => [bx + lean * t * t, by - h * t]
      const L: number[][] = []
      const Rt: number[][] = []
      for (let i = 0; i <= 8; i++) {
        const t = i / 8
        const [x, y] = P(t)
        const w = 2.2 * (1 - t) + 0.7
        L.push([x - w, y])
        Rt.push([x + w, y])
      }
      stalk = poly(L.concat(Rt.reverse()))
      for (const sd of [-1, 1]) {
        const ll = h * 0.28
        stalk += cut(
          [
            [bx, by],
            [bx + sd * ll * 0.35, by - ll * 0.5],
            [bx + sd * ll * 0.9, by - ll * 0.62],
            [bx + sd * ll * 0.55, by - ll * 0.18],
          ],
          0.5,
          6,
        )
      }
      for (let t = 0.36; t < 0.97; t += 0.048) {
        const [x, y] = P(t)
        const sm = h * 0.075 * (1 - (t - 0.36) * 1.05)
        const sd = side * (Math.round(t * 100) % 3 === 0 ? -1 : 1)
        if (t > 0.86) {
          bells += cut(circ(x + sd * sm * 0.35, y + sm * 0.2, sm * 0.42, 7), 0.2, 3)
          continue
        }
        bells += cut(
          [
            [x, y - sm * 0.15],
            [x + sd * sm * 0.55, y + sm * 0.05],
            [x + sd * sm * 1.05, y + sm * 1.05],
            [x + sd * sm * 0.78, y + sm * 1.28],
            [x + sd * sm * 0.38, y + sm * 1.14],
            [x + sd * sm * 0.12, y + sm * 0.5],
          ],
          0.25,
          3,
        )
        inner += cut(circ(x + sd * sm * 0.66, y + sm * 1.02, sm * 0.13, 6), 0.1, 3)
      }
      return { stalk, bells, inner }
    }

    const FOX = `
      <g class="pf-fox-tail"><path class="c-fox" d="M-30 -38C-46 -51 -70 -53 -86 -41C-96 -33 -99 -19 -93 -8C-87 -16 -76 -22 -64 -24C-52 -26 -41 -26 -32 -28Z"/>
        <path class="c-foxc" d="M-93 -8C-99 -19 -96 -33 -86 -41C-84 -33 -80 -24 -76 -18C-82 -16 -88 -12 -93 -8Z"/>
        <animateTransform attributeName="transform" type="rotate" values="0 -32 -32;-7 -32 -32;0 -32 -32;4 -32 -32;0 -32 -32" dur="2.8s" repeatCount="indefinite"/></g>
      <path class="c-foxd" d="M-22 -24L-15 -24L-16.5 -1H-22.5ZM13 -24L19 -24L18.5 -1H12.5Z" opacity=".78"/>
      <path class="c-fox" d="M-34 -30C-38 -41 -29 -49 -13 -49.5C3 -50.5 18 -50 28 -44C34 -40 36 -32 32 -24C26 -19 16 -19 8 -21L-20 -21C-28 -21 -33 -24 -34 -30Z"/>
      <path class="c-foxd" d="M-31.5 -26L-23 -24L-24 -1.5C-21 -1.2 -20 -0 -20 0H-31L-30.5 -2ZM22 -27L29 -27L29.5 -1.5C32 -1 33 0 33 0H23Z"/>
      <path class="c-fox" d="M22 -40C24 -48 27 -54 30 -58L28.5 -75L38 -63.5L44 -64L50.5 -77L52.5 -61C56 -57 60.5 -54 66 -51.5C68.5 -50.5 68.5 -47 66 -46C60 -44 54 -43 48 -41C42 -38 36 -34 30 -32Z"/>
      <path class="c-foxc" d="M40 -48.5C48 -50.5 58 -50.5 66 -46C60 -44 54 -43 48 -41C44 -39 40 -37 35.5 -35C37 -40 38 -45 40 -48.5ZM23.5 -38.5C29 -36.5 33 -35 36 -35.5C34 -30 30 -24.5 24.5 -22.5C22 -28 22 -34 23.5 -38.5Z"/>
      <path class="c-foxd" d="M31 -70.5L35.8 -63.8L31.6 -62.6ZM49.2 -71.6L50.2 -62.4L46.2 -63.4Z"/>
      <path class="c-foxd" d="M46.5 -58.2C48.6 -60.4 51.6 -60.4 53.2 -58.4C51 -57.2 48.8 -57.2 46.5 -58.2Z"><animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 .1;1 1" keyTimes="0;.9;.95;1" dur="4.6s" repeatCount="indefinite" additive="sum"/></path>
      <circle class="c-foxd" cx="66.6" cy="-48.6" r="2.4"/>`

    // 适配各图层尺寸。
    // 这里不再按层写入 --d 延迟：九层错开换色叠在一起就是一层一层地闪，
    // 现在全场景共用 PaperForest.css 里的 --pf-nd 一个节拍。
    const layerEls = Array.from(stage.querySelectorAll<HTMLElement>('.pf-layer'))
    layerEls.forEach((el) => {
      el.style.left = -M + 'px'
      el.style.top = -M + 'px'
      el.style.width = lw + 'px'
      el.style.height = lh + 'px'
      const sEl = el.querySelector<SVGElement>(':scope>svg')
      if (sEl) {
        sEl.setAttribute('viewBox', `${-M} ${-M} ${lw} ${lh}`)
        sEl.setAttribute('width', String(lw))
        sEl.setAttribute('height', String(lh))
      }
    })

    const svgOf = (id: string) => stage.querySelector<SVGElement>(`#${id}>svg`)
    function P<T>(land: T, port: T): T {
      return portrait ? port : land
    }

    /* sheet 1 — 远山 */
    const far = wave(H * P(0.395, 0.43), [H * 0.034, H * 0.016, H * 0.007], [W * 1.15, W * 0.43, W * 0.16])
    const d1 = ridge(far, H + M)
    const l1 = svgOf('pfL1')
    if (l1) l1.innerHTML = `<path class="c-far" d="${d1}"/><path class="pf-grain" d="${d1}"/>`

    /* sheet 2 — 起伏山丘、微型松树与两间亮灯村舍 */
    const hill = wave(H * P(0.47, 0.5), [H * 0.036, H * 0.014, H * 0.006], [W * 0.9, W * 0.34, W * 0.13])
    let d2 = ridge(hill, H + M)
    const phs = R() * 6
    for (let x = -M; x < W + M; x += rr(5, 15)) {
      if (Math.sin((x / W) * 8.5 + phs) + Math.sin((x / W) * 21 + phs * 2) * 0.5 > 0.35) {
        const h = rr(2.1, 4.2) * U
        d2 += pine(x, hill(x) + 3, h, h * 0.55)
      }
    }
    let roofs = ''
    let wins = ''
    let glows = ''
    for (const cxF of P([0.2, 0.8], [0.24, 0.8])) {
      const cx = W * cxF
      const sz = Math.max(12, U * 2.3)
      const by = hill(cx) + sz * 0.25
      d2 += cut(
        [
          [cx - sz * 0.52, by],
          [cx - sz * 0.52, by - sz * 0.62],
          [cx + sz * 0.52, by - sz * 0.62],
          [cx + sz * 0.52, by],
        ],
        0.4,
        5,
      )
      d2 += cut(
        [
          [cx + sz * 0.2, by - sz * 0.8],
          [cx + sz * 0.2, by - sz * 1.12],
          [cx + sz * 0.36, by - sz * 1.12],
          [cx + sz * 0.36, by - sz * 0.7],
        ],
        0.3,
        4,
      )
      roofs += cut(
        [
          [cx - sz * 0.66, by - sz * 0.54],
          [cx, by - sz * 1.08],
          [cx + sz * 0.66, by - sz * 0.54],
        ],
        0.4,
        4,
      )
      for (const wx of [-0.26, 0.18]) {
        wins += poly([
          [cx + wx * sz, by - sz * 0.42],
          [cx + (wx + 0.15) * sz, by - sz * 0.42],
          [cx + (wx + 0.15) * sz, by - sz * 0.24],
          [cx + wx * sz, by - sz * 0.24],
        ])
      }
      glows += `<circle class="winglow" cx="${q(cx)}" cy="${q(by - sz * 0.35)}" r="${q(sz * 1.5)}" fill="url(#pfWinGlowGrad)"/>`
    }
    const l2 = svgOf('pfL2')
    if (l2) {
      l2.innerHTML = `<path class="c-hill" d="${d2}"/><path class="c-roof" d="${roofs}"/><path class="pf-grain" d="${d2}${roofs}"/>${glows}<path class="c-win" d="${wins}"/>`
    }

    /* sheet 3 — 鼠尾草松脊 */
    const rg = wave(H * P(0.545, 0.565), [H * 0.014, H * 0.007], [W * 0.7, W * 0.23])
    let d3 = ridge(rg, H + M)
    for (let x = -M; x < W + M; ) {
      const h = rr(3.6, 7.8) * U * (portrait ? 1.15 : 1)
      const w = h * rr(0.46, 0.58)
      d3 += pine(x, rg(x) + 4, h, w)
      x += w * rr(0.42, 0.8)
    }
    const l3 = svgOf('pfL3')
    if (l3) l3.innerHTML = `<path class="c-ridge" d="${d3}"/><path class="pf-grain" d="${d3}"/>`

    /* sheet 4 — 草甸与蜿蜒溪流 */
    const md = wave(H * P(0.6, 0.615), [H * 0.008, H * 0.004], [W * 0.8, W * 0.25])
    const d4 = ridge(md, H + M, 10, 0.6)
    const yBot = H * P(0.86, 0.84)
    const N = 40
    const amp = W * P(0.12, 0.2)
    const phRiver = R() * 0.7 - 0.2
    const cl: number[][] = []
    const Lb: number[][] = []
    const Rb: number[][] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const y = md(W * 0.5) + 5 + (yBot - md(W * 0.5) - 5) * Math.pow(t, 1.3)
      const x = W * 0.52 + amp * Math.sin(t * Math.PI * 1.9 + phRiver) * Math.pow(t, 0.65) + W * 0.03 * Math.sin(t * 9 + phRiver)
      const w = W * 0.006 + W * P(0.25, 0.4) * Math.pow(t, 1.75)
      cl.push([x, y, w])
      Lb.push([x - w / 2 + (R() - 0.5) * 1.4, y])
      Rb.push([x + w / 2 + (R() - 0.5) * 1.4, y])
    }
    const dr = poly(Lb.concat(Rb.slice().reverse()))
    let rip = ''
    let gl = ''
    for (let i = 0; i < 22; i++) {
      const k = Math.floor(rr(0.18, 1) * N)
      const [x, y, w] = cl[k]
      const cx = x + (R() - 0.5) * w * 0.55
      const len = w * rr(0.12, 0.32)
      const th = Math.max(1, w * 0.022)
      rip += poly([
        [cx - len / 2, y],
        [cx, y - th],
        [cx + len / 2, y],
        [cx, y + th * 0.6],
      ])
    }
    for (let i = 0; i < 16; i++) {
      const k = Math.floor(rr(0.1, 0.95) * N)
      const [x, y, w] = cl[k]
      const cx = x + (R() - 0.5) * w * 0.35
      const len = Math.max(3, w * rr(0.05, 0.14))
      const th = Math.max(0.8, w * 0.012)
      gl += `<path class="glint" style="animation-delay:${(R() * 3).toFixed(2)}s" d="${poly([
        [cx - len / 2, y],
        [cx, y - th],
        [cx + len / 2, y],
        [cx, y + th],
      ])}"/>`
    }
    const l4 = svgOf('pfL4')
    if (l4) {
      l4.innerHTML = `<path class="c-meadow" d="${d4}"/><path class="c-river" d="${dr}"/><path class="c-ripple" d="${rip}"/><path class="pf-grain" d="${d4}"/>${gl}`
    }

    /* sheet 5 — 两岸苔藓松 */
    const w5 = wave(0, [H * 0.012, H * 0.006], [W * 0.5, W * 0.17])
    const xL5 = W * P(0.4, 0.44)
    const xR5 = W * P(0.61, 0.56)
    const y5 = H * P(0.675, 0.69)
    const bL5 = bankFn(-M, xL5, y5, w5)
    const bR5 = bankFn(W + M, xR5, y5 * 1.005, w5)
    let d5 = bankPath(bL5, -M, xL5) + bankPath(bR5, W + M, xR5)
    const pinesAlong = (
      fn: (x: number) => number,
      xa: number,
      xb: number,
      hMin: number,
      hMax: number,
      wr: number,
      fromEdge: (x: number) => number,
    ) => {
      let d = ''
      for (let x = xa; x < xb; ) {
        const sm = fromEdge(x)
        const h = rr(hMin, hMax) * (1 - sm * 0.5)
        const w = Math.min(h * wr, W * P(0.14, 0.2))
        if (fn(x) < H * 0.95) d += pine(x, fn(x) + 5, h, w)
        x += w * rr(0.4, 0.7)
      }
      return d
    }
    d5 += pinesAlong(bL5, -M * 0.6, xL5 * 0.74, H * P(0.2, 0.19), H * P(0.36, 0.3), 0.44, (x) =>
      clamp((x + M) / (xL5 + M), 0, 1),
    )
    d5 += pinesAlong(bR5, xR5 + (W - xR5) * 0.26, W + M * 0.6, H * P(0.2, 0.19), H * P(0.36, 0.3), 0.44, (x) =>
      clamp((W + M - x) / (W + M - xR5), 0, 1),
    )
    const l5 = svgOf('pfL5')
    if (l5) l5.innerHTML = `<path class="c-moss" d="${d5}"/><path class="pf-grain" d="${d5}"/>`

    /* sheet 6 — 参天深青巨松 */
    const w6 = wave(0, [H * 0.01, H * 0.005], [W * 0.4, W * 0.15])
    const xL6 = W * P(0.26, 0.34)
    const xR6 = W * P(0.74, 0.66)
    const y6 = H * P(0.82, 0.83)
    const bL6 = bankFn(-M, xL6, y6, w6)
    const bR6 = bankFn(W + M, xR6, y6, w6)
    let d6 = bankPath(bL6, -M, xL6) + bankPath(bR6, W + M, xR6)
    const giants = portrait
      ? [
          [-0.06, 0.9],
          [0.12, 0.52],
          [1.05, 0.86],
          [0.9, 0.5],
        ]
      : [
          [0.015, 1.02],
          [0.098, 0.7],
          [0.975, 0.96],
          [0.9, 0.64],
        ]
    for (const [gx, gh] of giants) {
      const x = W * gx
      const h = H * gh
      const w = Math.min(h * 0.4, W * P(0.2, 0.36))
      d6 += pine(x, (gx < 0.5 ? bL6 : bR6)(x) + 8, h, w)
    }
    const l6 = svgOf('pfL6')
    if (l6) l6.innerHTML = `<path class="c-teal" d="${d6}"/><path class="pf-grain" d="${d6}"/>`

    /* sheet 7 — 赭石色林地、蘑菇簇、蕨类与小狐狸 */
    const g7w = wave(H * P(0.785, 0.8), [H * 0.011, H * 0.006], [W * 0.95, W * 0.3])
    const burX = W * P(0.25, 0.2)
    const burR = W * P(0.1, 0.18)
    const g7 = (x: number) => g7w(x) - H * 0.04 * Math.exp(-Math.pow((x - burX) / burR, 2))
    s.groundAt = g7
    let d7 = ridge(g7, H + M, 8, 0.7)
    let tufts = ''
    for (let x = -M; x < W + M; x += rr(18, 60)) {
      const y = g7(x) + 2
      const n = 3 + Math.floor(R() * 3)
      for (let k = 0; k < n; k++) {
        tufts += blade(x + k * 2.2, y + 2, rr(0.9, 2.1) * U, rr(-0.6, 0.6) * U, rr(2, 3.4))
      }
    }
    const bw = Math.max(18, W * P(0.042, 0.085))
    const bh = bw * 0.72
    const by0 = g7(burX) + bh * 1.25
    const arch: number[][] = [[burX - bw / 2, by0]]
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI
      arch.push([burX + (Math.cos(a) * bw) / 2, by0 - bh * 0.35 + Math.sin(a) * bh * 0.9])
    }
    arch.push([burX + bw / 2, by0])
    const burrow = cut(arch, 0.6, 5)
    let stems = ''
    let caps = ''
    let dots = ''
    const clusters = P(
      [
        [0.1, 4],
        [0.6, 3],
        [0.87, 5],
        [0.38, 2],
      ],
      [
        [0.12, 3],
        [0.64, 3],
        [0.9, 2],
      ],
    )
    for (const [cf, n] of clusters) {
      for (let k = 0; k < n; k++) {
        const x = W * cf + (k - (n - 1) / 2) * U * rr(1.4, 2.6)
        const sz = U * rr(1.1, 3.1) * (k === Math.floor(n / 2) ? 1.25 : 1) * P(1, 1.25)
        const m = mushroom(x, g7(x) + sz * 0.18, sz)
        stems += m.stem
        caps += m.cap
        dots += m.dots
      }
    }
    let ferns = ''
    for (const [ff, sz, dr2] of P(
      [
        [0.03, 13, 1],
        [0.33, 9, -1],
        [0.47, 7, 1],
        [0.72, 10, 1],
        [0.96, 12, -1],
      ],
      [
        [0.04, 12, 1],
        [0.42, 9, -1],
        [0.78, 10, 1],
      ],
    )) {
      const x = W * ff
      ferns += fern(x, g7(x) + 4, sz * U * P(1, 1.25), dr2)
      ferns += fern(x + U * 0.8, g7(x) + 4, sz * U * 0.7 * P(1, 1.25), -dr2)
    }
    let pebbles = ''
    for (let i = 0; i < 9; i++) {
      const x = rr(0.05, 0.95) * W
      const y = g7(x) + rr(0.6, 3.5) * U
      const r = rr(0.3, 0.75) * U
      pebbles += cut(
        circ(x, y, r, 9).map(([a, b]) => [a, y + (b - y) * 0.6]),
        0.25,
        3,
      )
    }
    let fall1 = ''
    let fall2 = ''
    let lowT = ''
    const nFall = Math.round(W / 48)
    for (let i = 0; i < nFall; i++) {
      const x = rr(-0.02, 1.02) * W
      const top = g7(x) + U * 2.2
      const y = top + Math.pow(R(), 1.3) * (H * 0.965 - top)
      const sz = rr(0.45, 0.9) * U
      const a = R() * Math.PI
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const lp = [
        [-1, 0],
        [-0.3, -0.42],
        [0.35, -0.36],
        [1, 0],
        [0.3, 0.4],
        [-0.35, 0.36],
      ].map(([u, v]) => [x + (u * ca - v * sa * 0.8) * sz, y + (u * sa + v * ca * 0.8) * sz * 0.62])
      if (R() < 0.6) fall1 += cut(lp, 0.2, 3)
      else fall2 += cut(lp, 0.2, 3)
    }
    for (let i = 0; i < Math.round(W / 90); i++) {
      const x = rr(0, 1) * W
      const y = g7(x) + rr(0.24, 0.8) * (H * 0.95 - g7(x))
      for (let k = 0; k < 3; k++) {
        lowT += blade(x + k * 2.4, y, rr(0.6, 1.4) * U, rr(-0.5, 0.5) * U, rr(2, 3))
      }
    }
    const l7 = svgOf('pfL7')
    if (l7) {
      l7.innerHTML = `<path class="c-ground" d="${d7}"/><path class="c-fall1" d="${fall1}"/><path class="c-fall2" d="${fall2}"/><path class="c-tuft" d="${tufts}${lowT}"/><path class="c-burrow" d="${burrow}"/><path class="c-pebble" d="${pebbles}"/><path class="c-fern" d="${ferns}"/><path class="c-stem" d="${stems}"/><path class="c-cap" d="${caps}"/><path class="pf-grain" d="${d7}${stems}${caps}"/><path class="c-dot glowdots" d="${dots}"/><g id="pfPuffs"></g><g id="pfFoxG">${FOX}</g>`
    }
    const pf = stage.querySelector('#pfPuffs')
    if (pf) {
      let ph2 = ''
      for (let i = 0; i < 8; i++) ph2 += `<path class="puff" d="M0 -2L2 1L-2 1Z"/>`
      pf.innerHTML = ph2
    }

    /* sheet 8 — 近景草丛与毛地黄 */
    const g8 = wave(H * P(0.945, 0.955), [H * 0.008, H * 0.005], [W * 0.6, W * 0.2])
    let d8 = ridge(g8, H + M, 9, 0.8)
    let fg2 = ''
    for (let x = -M; x < W + M; x += rr(3.5, 9)) {
      const sPos = Math.abs(x - W / 2) / (W / 2)
      const hm = H * (0.018 + P(0.23, 0.2) * Math.pow(clamp(sPos, 0, 1.2), 2.4))
      const h = hm * rr(0.35, 1)
      const lean = rr(-0.38, 0.38) * h
      const wb = rr(4, 9) * (U / 11 + 0.4)
      const b = blade(x, g8(x) + 6, h, lean, wb)
      if (R() < 0.3) fg2 += b
      else d8 += b
    }
    let stalks = ''
    let bells = ''
    let inner = ''
    for (const [fx, fh, fl, sd] of P(
      [
        [0.065, 0.4, 0.05, 1],
        [0.115, 0.29, -0.03, 1],
        [0.925, 0.36, -0.04, -1],
        [0.885, 0.24, 0.03, -1],
      ],
      [
        [0.08, 0.3, 0.04, 1],
        [0.92, 0.26, -0.04, -1],
      ],
    )) {
      const x = W * fx
      const f = foxglove(x, g8(x) + 4, H * fh, W * fl, sd)
      stalks += f.stalk
      bells += f.bells
      inner += f.inner
    }
    const l8 = svgOf('pfL8')
    if (l8) {
      l8.innerHTML = `<path class="c-fg2" d="${fg2}"/><path class="c-fg" d="${d8}${stalks}"/><path class="c-bell" d="${bells}"/><path class="c-bell2" d="${inner}"/><path class="pf-grain" d="${d8}${fg2}${stalks}${bells}"/>`
    }

    /* sheet 9 — 外框与毛边纸卡 */
    const eEdge = Math.max(10, Math.min(W, H) * 0.024)
    const rad = eEdge * 3
    const outer = [
      [-M - 4, -M - 4],
      [W + M + 4, -M - 4],
      [W + M + 4, H + M + 4],
      [-M - 4, H + M + 4],
    ]
    const rrect = (ins: number, wob: number) => {
      const p: number[][] = []
      const x0 = ins
      const y0 = ins
      const x1 = W - ins
      const y1 = H - ins
      const r = rad
      const seg = (ax: number, ay: number, bx: number, by: number) => {
        const L = Math.hypot(bx - ax, by - ay)
        const k = Math.max(1, Math.round(L / 11))
        for (let t = 0; t < k; t++) {
          const u = t / k
          p.push([ax + (bx - ax) * u + (R() - 0.5) * wob, ay + (by - ay) * u + (R() - 0.5) * wob])
        }
      }
      const arc = (cx: number, cy: number, a0: number) => {
        for (let i = 0; i < 6; i++) {
          const a = a0 + (i / 6) * (Math.PI / 2)
          p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
        }
      }
      seg(x0 + r, y0, x1 - r, y0)
      arc(x1 - r, y0 + r, -Math.PI / 2)
      seg(x1, y0 + r, x1, y1 - r)
      arc(x1 - r, y1 - r, 0)
      seg(x1 - r, y1, x0 + r, y1)
      arc(x0 + r, y1 - r, Math.PI / 2)
      seg(x0, y1 - r, x0, y0 + r)
      arc(x0 + r, y0 + r, Math.PI)
      return p
    }
    const mat = cut(outer, 0, 4000) + hole(rrect(eEdge, 2.4), 0.5, 6)
    const frame = cut(outer, 0, 4000) + hole(rrect(eEdge * 0.55, 1.2), 0.3, 8)
    const l9 = svgOf('pfL9')
    if (l9) {
      l9.innerHTML = `<path class="c-mat" d="${mat}"/><path class="c-frame" d="${frame}"/><path class="pf-grain" d="${frame}"/>`
    }

    // 组装悬挂吊杆体系 (Fly-system: Sun, Clouds, Moon, Stars)
    const hang = stage.querySelector<HTMLElement>('#pfHang')
    if (hang) {
      const mSize = Math.min(W, H)
      const sunD = clamp(mSize * 0.16, 78, 168)
      const sunX = W * (portrait ? 0.74 : 0.7)
      const sunY = H * (portrait ? 0.33 : 0.2)
      // 吊杆上的物件：白昼件（太阳、云）与静夜件（月亮、星芒）各一组，
      // 靠 .pf-night 把两组在上下两个位置之间对调。
      // 这里不再给每件排延迟（原来 --hd 让它们错开起落，十一个吊件
      // 各走各的，切换时整片天空都在动，看起来就是闪）。
      const items: Array<{ cls: string; x: number; y: number; h: number; html: string }> = []

      // 太阳
      const rays: number[][] = []
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * Math.PI * 2
        const r = i % 2 ? 47 : 58
        rays.push([Math.cos(a) * r, Math.sin(a) * r])
      }
      const sunSvg = `<svg viewBox="-62 -62 124 124" width="${q(sunD)}" height="${q(sunD)}"><path fill="#c8642d" d="${cut(rays, 0.5, 5)}"/><path fill="#d9a45b" d="${cut(circ(0, 0, 42, 40), 0.5, 5)}"/><path fill="#e6b772" d="${cut(circ(-4, -5, 29, 30), 0.4, 5)}"/></svg>`
      items.push({ cls: 'day', x: sunX, y: sunY, h: sunD, html: sunSvg })

      // 月亮
      const moonD = sunD * 0.86
      const moonSvg = `<span class="pf-halo"></span><svg viewBox="-50 -50 100 100" width="${q(moonD)}" height="${q(moonD)}" style="position:relative"><path fill="#f5ecd6" d="${cut(circ(0, 0, 44, 44), 0.5, 5)}"/><path fill="#e3d4b3" d="${cut(circ(-14, -10, 9, 14), 0.4, 3)}${cut(circ(12, 8, 6, 10), 0.3, 3)}${cut(circ(-6, 18, 5, 9), 0.3, 3)}${cut(circ(18, -16, 4, 8), 0.3, 3)}"/></svg>`
      items.push({ cls: 'nite', x: sunX - mSize * 0.02, y: sunY - mSize * 0.02, h: moonD, html: moonSvg })

      // 云朵
      const cloudShape = (sc: number) => {
        let d = ''
        for (const [cx, cy, r] of [
          [-30, 4, 17],
          [-9, -9, 24],
          [16, -5, 20],
          [35, 6, 13],
        ]) {
          d += cut(circ(cx * sc, cy * sc, r * sc, 22), 0.5, 5)
        }
        d += cut(
          [
            [-46 * sc, 20 * sc],
            [-46 * sc, 6 * sc],
            [48 * sc, 6 * sc],
            [48 * sc, 20 * sc],
          ],
          0.5,
          6,
        )
        return d
      }
      const clouds = portrait
        ? [
            [0.8, 0.12, 0.8],
            [0.5, 0.375, 0.6],
          ]
        : [
            [0.44, 0.12, 1],
            [0.575, 0.305, 0.62],
          ]
      clouds.forEach(([cx, cy, sc]) => {
        const cw = mSize * 0.19 * sc
        items.push({
          cls: 'day',
          x: W * cx,
          y: H * cy,
          h: cw * 0.5,
          html: `<svg viewBox="-52 -36 104 60" width="${q(cw)}" height="${q(cw * 0.58)}"><path fill="#fbf6ea" d="${cloudShape(1)}"/><path fill="rgba(217,164,91,.16)" d="${cut([[-46, 20], [-46, 13], [48, 13], [48, 20]], 0.4, 6)}"/></svg>`,
        })
      })

      // 吊绳星芒
      const starPts = (r1: number, r2: number) => {
        const p: number[][] = []
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5
          const r = i % 2 ? r2 : r1
          p.push([Math.cos(a) * r, Math.sin(a) * r])
        }
        return p
      }
      const stars = portrait
        ? [
            [0.14, 0.4],
            [0.5, 0.26],
            [0.88, 0.16],
            [0.4, 0.38],
            [0.64, 0.12],
          ]
        : [
            [0.36, 0.1],
            [0.5, 0.26],
            [0.58, 0.08],
            [0.84, 0.36],
            [0.93, 0.12],
            [0.3, 0.3],
            [0.76, 0.06],
          ]
      stars.forEach(([sx, sy]) => {
        const ss = mSize * rr(0.024, 0.036)
        items.push({
          cls: 'nite',
          x: W * sx,
          y: H * sy,
          h: ss,
          html: `<svg viewBox="-12 -12 24 24" width="${q(ss)}" height="${q(ss)}"><path fill="#e8b865" d="${cut(starPts(11, 4.6), 0.2, 3)}"/></svg>`,
        })
      })

      hang.innerHTML = items
        .map((it) => {
          const len = it.y + M
          const up = len + it.h * 1.6 + 40
          return `<div class="pf-hang ${it.cls}" style="left:${q(it.x + M)}px;--len:${q(len)}px;--up:${q(up)}"><div class="pf-swing" style="--sd:${(4 + R() * 3).toFixed(2)}s;--sdl:-${(R() * 4).toFixed(2)}s"><span class="pf-string"></span><div class="pf-obj">${it.html}</div></div></div>`
        })
        .join('')
    }

    // 星芒底点
    const pins = stage.querySelector<SVGElement>('#pfPins')
    if (pins) {
      pins.setAttribute('viewBox', `0 0 ${W} ${H}`)
      let pinHtml = ''
      const nPins = Math.round((W * H) / 9000)
      for (let i = 0; i < nPins; i++) {
        const x = R() * W
        const y = Math.pow(R(), 1.4) * H * 0.5
        const r = rr(0.5, 1.5)
        pinHtml += `<circle${R() < 0.35 ? ' class="tw"' : ''} style="animation-delay:-${(R() * 3).toFixed(2)}s" cx="${q(x)}" cy="${q(y)}" r="${q(r)}"/>`
      }
      pins.innerHTML = pinHtml
    }

    // 放置小狐狸
    s.fox.x = s.fox.fx * W
    s.fox.y = s.groundAt(s.fox.x)
    s.fox.s = clamp(U * (portrait ? 0.78 : 0.72), 5, 11.5) / 8
    renderFox(0)

    // 重置萤火虫画布
    sizeFlies()

    // 缓存视差图层与景深因子，避免在每帧 RAF 中反复 querySelectorAll
    s.layersCache = layerEls.map((el) => {
      const depth = parseFloat(el.dataset.depth || '0')
      return { el, f: Math.pow(depth / 8, 1.15) * s.S }
    })
    s.lastRenderPx = -9999
    s.lastRenderPy = -9999
  }, [])

  // 渲染狐狸变换
  const renderFox = useCallback((lift: number) => {
    const s = stateRef.current
    const stage = stageRef.current
    const btn = foxBtnRef.current
    if (!stage || !btn) return
    const g = stage.querySelector('#pfFoxG')
    if (!g) return
    const sx = s.fox.sx * s.fox.s * s.fox.dir
    const sy = s.fox.sy * s.fox.s
    g.setAttribute('transform', `translate(${Math.round(s.fox.x * 10) / 10} ${Math.round((s.fox.y - lift) * 10) / 10}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`)
    const bw = 150 * s.fox.s
    const bh = 80 * s.fox.s
    btn.style.width = Math.round(bw) + 'px'
    btn.style.height = Math.round(bh) + 'px'
    btn.style.transform = `translate(${Math.round(s.fox.x + s.M - bw / 2 + s.fox.dir * (-8 * s.fox.s))}px,${Math.round(s.fox.y - lift + s.M - bh)}px)`
  }, [])

  // 狐狸起跳
  const hop = useCallback(() => {
    const s = stateRef.current
    if (reducedRef.current) return
    if (s.fox.hop) return
    const minX = s.W * 0.12
    const maxX = s.W * 0.88
    let tx = s.fox.x
    for (let k = 0; k < 12; k++) {
      tx = minX + Math.random() * (maxX - minX)
      if (Math.abs(tx - s.fox.x) > s.W * 0.14 && Math.abs(tx - s.fox.x) < s.W * 0.5) break
    }
    const dist = Math.abs(tx - s.fox.x)
    s.fox.hop = {
      t: 0,
      x0: s.fox.x,
      x1: tx,
      dur: 0.55 + (dist / s.W) * 0.6,
      hgt: Math.max((40 * s.fox.s * 6) / 8, dist * 0.32),
    }
    s.fox.dir = tx > s.fox.x ? 1 : -1
  }, [])

  // 落地烟尘
  const landPuff = useCallback(() => {
    const s = stateRef.current
    const stage = stageRef.current
    if (!stage) return
    const pf = stage.querySelector('#pfPuffs')
    const els = pf ? Array.from(pf.children as HTMLCollectionOf<SVGElement>) : []
    const rr = (a: number, b: number) => a + (b - a) * s.R()
    s.puffs = []
    for (let i = 0; i < els.length; i++) {
      const a = Math.PI + (i / Math.max(1, els.length - 1)) * Math.PI
      s.puffs[i] = {
        el: els[i],
        x: s.fox.x,
        y: s.fox.y - 2,
        vx: Math.cos(a) * rr(40, 90) * s.fox.s,
        vy: Math.sin(a) * rr(30, 70) * s.fox.s,
        r: s.R() * 6,
        t: 0,
      }
    }
  }, [])

  // 纸片落叶初始化
  const makeLeaves = useCallback(() => {
    const leavesEl = leavesRef.current
    const s = stateRef.current
    if (!leavesEl) return
    const leafShapes = [
      'M0 -9C5 -6 6 1 0 9C-6 1 -5 -6 0 -9Z',
      'M0 -9L2.5 -4L6.5 -5L4.5 0L7 3L2 3.5L0 9L-2 3.5L-7 3L-4.5 0L-6.5 -5L-2.5 -4Z',
      'M0 -9C3 -7 4.5 -3 3.5 0C5 2 4 6 0 9C-4 6 -5 2 -3.5 0C-4.5 -3 -3 -7 0 -9Z',
    ]
    const leafCls = ['lf-a', 'lf-b', 'lf-c', 'lf-a', 'lf-b']
    // 减少动画时一片都不生成；点击落叶也走同一条 s.leaves 列表，所以一并失效
    const n = reducedRef.current ? 0 : 18
    let html = ''
    for (let i = 0; i < n; i++) {
      html += `<div class="pf-leaf"><svg viewBox="-10 -10 20 20" width="20" height="20"><path class="${leafCls[i % 5]}" d="${leafShapes[i % 3]}"/><path class="lf-v" d="M0 -7V8"/></svg></div>`
    }
    leavesEl.innerHTML = html
    s.leaves = []
    Array.from(leavesEl.children as HTMLCollectionOf<HTMLElement>).forEach((el, i) => {
      s.leaves.push({
        el,
        on: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        vr: 0,
        ph: Math.random() * 6,
        sz: 1,
        ambient: i < (s.W < 640 ? 5 : 8),
      })
    })
    const spawn = (l: typeof s.leaves[0], x: number, y: number) => {
      const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
      l.on = true
      l.x = x
      l.y = y
      l.vx = 8 + Math.random() * 18
      l.vy = 18 + Math.random() * 16
      l.rot = Math.random() * 360
      l.vr = (Math.random() - 0.5) * 180
      l.sz = (0.8 + Math.random() * 0.7) * clamp(s.U / 9, 0.7, 1.4)
      l.el.style.opacity = '1'
    }
    s.leaves.forEach((l) => {
      if (l.ambient) spawn(l, Math.random() * s.W, Math.random() * s.H * 0.9)
      else l.el.style.opacity = '0'
    })
  }, [])

  // 爆发飘叶
  const leafBurst = useCallback((cx: number, cy: number) => {
    const s = stateRef.current
    const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
    let n = 0
    for (const l of s.leaves) {
      if (!l.on && !l.ambient) {
        l.on = true
        l.x = cx
        l.y = cy
        l.vx = (Math.random() - 0.5) * 160
        l.vy = -70 + Math.random() * 50
        l.rot = Math.random() * 360
        l.vr = (Math.random() - 0.5) * 180
        l.sz = (0.8 + Math.random() * 0.7) * clamp(s.U / 9, 0.7, 1.4)
        l.el.style.opacity = '1'
        if (++n >= 4) break
      }
    }
  }, [])

  // 萤火虫画布重置
  const sizeFlies = useCallback(() => {
    const fc = canvasRef.current
    const s = stateRef.current
    if (!fc) return
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    fc.width = Math.round((s.W + 2 * s.M) * dpr)
    fc.height = Math.round((s.H + 2 * s.M) * dpr)
    fc.style.width = s.W + 2 * s.M + 'px'
    fc.style.height = s.H + 2 * s.M + 'px'
    const n = s.W < 640 ? 18 : 34
    s.flies = []
    for (let i = 0; i < n; i++) {
      s.flies.push({
        x: Math.random() * s.W,
        y: s.H * (0.45 + Math.random() * 0.5),
        a: Math.random() * 6.28,
        sp: 12 + Math.random() * 14,
        ph: Math.random() * 6.28,
        bl: 0.6 + Math.random() * 0.8,
        z: 0.6 + Math.random() * 0.6,
      })
    }
    if (!s.flySprite && typeof document !== 'undefined') {
      try {
        const sprite = document.createElement('canvas')
        sprite.width = sprite.height = 64
        const g = sprite.getContext('2d')
        if (g) {
          const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
          gr.addColorStop(0, 'rgba(255,250,200,1)')
          gr.addColorStop(0.14, 'rgba(246,236,130,.95)')
          gr.addColorStop(0.4, 'rgba(214,230,110,.28)')
          gr.addColorStop(1, 'rgba(200,220,100,0)')
          g.fillStyle = gr
          g.fillRect(0, 0, 64, 64)
          s.flySprite = sprite
        }
      } catch {
        // 安全静默
      }
    }
  }, [])

  // 昼夜切换处理。
  // 注意不要在 setIsNight 的 updater 里做副作用：React 在 StrictMode 下会
  // 重复调用 updater 来检查纯函数，onToggleNight 会被通知两次、tagV 也会加两次。
  const toggleNight = useCallback(() => {
    const next = !isNight
    stateRef.current.tagV += 18
    setIsNight(next)
    onToggleNight?.(next)
  }, [isNight, onToggleNight])

  // 同步昼夜类名至 document.body
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('pf-night', isNight)
    }
  }, [isNight])

  // 重新剪纸
  const recut = useCallback(() => {
    stateRef.current.seed = (Math.random() * 1e9) | 0
    build()
    const stage = stageRef.current
    if (stage) {
      const layerEls = Array.from(stage.querySelectorAll<HTMLElement>('.pf-layer'))
      layerEls.forEach((el) => {
        if (el.classList.contains('pf-place')) {
          el.classList.remove('pf-place')
          void el.offsetWidth
          el.classList.add('pf-place')
        }
      })
    }
    stateRef.current.tagV -= 24
  }, [build])

  // 外部触发重剪。控件搬进设置之后走这条路径；只在数值真正变化时触发，挂载时不重剪。
  const lastRecutSignal = useRef(recutSignal)
  useEffect(() => {
    if (recutSignal === undefined || lastRecutSignal.current === recutSignal) return
    lastRecutSignal.current = recutSignal
    recut()
  }, [recutSignal, recut])

  // 主循环初始化与挂载
  useEffect(() => {
    const s = stateRef.current
    const stage = stageRef.current
    if (!stage) return

    build()
    makeLeaves()

    // 运行帧循环
    let running = true
    const frame = (now: number) => {
      if (!running) return
      s.rafId = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - (s.lastTime || now)) / 1000)
      s.lastTime = now
      s.clock += dt

      const targetNight = (typeof document !== 'undefined' && document.body.classList.contains('pf-night')) || stage.classList.contains('pf-night') ? 1 : 0
      s.nightAmt += (targetNight - s.nightAmt) * (1 - Math.exp(-dt * 1.6))

      // 1. 视差缓动 (带微阈值节流：光标静止时避免反复写 DOM transform，保证 60fps)
      const k = 1 - Math.exp(-dt * 3.4)
      s.px += (s.tx - s.px) * k
      s.py += (s.ty - s.py) * k
      if (Math.abs(s.px - s.lastRenderPx) > 0.0005 || Math.abs(s.py - s.lastRenderPy) > 0.0005) {
        s.lastRenderPx = s.px
        s.lastRenderPy = s.py
        const cache = s.layersCache
        for (let i = 0; i < cache.length; i++) {
          const item = cache[i]
          item.el.style.transform = `translate3d(${Math.round(-s.px * item.f * 10) / 10}px,${Math.round(-s.py * item.f * 0.55 * 10) / 10}px,0)`
        }
      }

      // 2. 行李签摆动
      const tagWrap = tagWrapRef.current
      if (tagWrap) {
        const rest = reducedRef.current ? -2.2 : -2.2 + Math.sin(s.clock * 0.6) * 0.6
        s.tagV += (-(s.tagA - rest) * 26 - s.tagV * 2.6) * dt
        s.tagA += s.tagV * dt
        s.tagA = Math.max(-16, Math.min(16, s.tagA))
        tagWrap.style.transform = `rotate(${s.tagA.toFixed(2)}deg)`
      }

      // 3. 树叶物理
      for (const l of s.leaves) {
        // 减少动画时已生成的叶子也不再飘。挂载时就开着的话根本不会有叶子
        // （makeLeaves 生成 0 片），但系统设置可能在使用中改变，那时叶子已经存在。
        if (reducedRef.current) continue
        if (!l.on) continue
        l.vy += (30 - l.vy) * dt * 1.4
        l.vx += (14 - l.vx) * dt * 0.8
        l.x += (l.vx + Math.sin(s.clock * 1.3 + l.ph) * 34) * dt
        l.y += l.vy * dt
        l.rot += l.vr * dt
        const flip = Math.sin(s.clock * 2.1 + l.ph) * 62
        l.el.style.transform = `translate3d(${Math.round(l.x + s.M)}px,${Math.round(l.y + s.M)}px,0) rotate(${Math.round(l.rot)}deg) rotateY(${Math.round(flip)}deg) scale(${l.sz.toFixed(2)})`
        if (l.y > s.H + 30 || l.x > s.W + 40) {
          if (l.ambient) {
            l.x = (Math.random() - 0.1) * s.W
            l.y = -30
          } else {
            l.on = false
            l.el.style.opacity = '0'
          }
        }
      }

      // 4. 小狐狸跳跃
      if (s.fox.hop) {
        const h = s.fox.hop
        h.t += dt / h.dur
        const t = Math.min(1, h.t)
        let lift = 0
        if (t < 0.16) {
          const u = t / 0.16
          s.fox.sy = 1 - 0.2 * Math.sin((u * Math.PI) / 2)
          s.fox.sx = 1 + 0.12 * Math.sin((u * Math.PI) / 2)
        } else if (t < 0.86) {
          const u = (t - 0.16) / 0.7
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
          s.fox.x = h.x0 + (h.x1 - h.x0) * e
          s.fox.y = s.groundAt(s.fox.x)
          lift = Math.sin(u * Math.PI) * h.hgt
          s.fox.sy = 1 + 0.14 * Math.cos(u * Math.PI)
          s.fox.sx = 1 - 0.08 * Math.cos(u * Math.PI)
        } else {
          const u = (t - 0.86) / 0.14
          if (!h.landed) {
            h.landed = true
            s.fox.x = h.x1
            s.fox.y = s.groundAt(s.fox.x)
            landPuff()
          }
          s.fox.sy = 1 - 0.18 * Math.sin(u * Math.PI)
          s.fox.sx = 1 + 0.1 * Math.sin(u * Math.PI)
        }
        renderFox(lift)
        if (t >= 1) {
          s.fox.hop = null
          s.fox.sx = s.fox.sy = 1
          s.fox.fx = s.fox.x / s.W
          renderFox(0)
        }
      }
      for (const p of s.puffs) {
        if (reducedRef.current) continue // 减少动画时已生成的云絮也停下
        if (!p || p.t >= 1) continue
        p.t += dt * 1.8
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 160 * dt
        p.r += dt * 8
        p.el.setAttribute(
          'transform',
          `translate(${Math.round(p.x)} ${Math.round(p.y)}) rotate(${Math.round(p.r * 40)}) scale(${(s.fox.s * 1.4).toFixed(2)})`,
        )
        p.el.style.opacity = (1 - p.t).toFixed(2)
      }

      // 5. 萤火虫微光
      const fc = canvasRef.current
      if (fc) {
        const fx = fc.getContext('2d')
        if (fx) {
          const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
          fx.setTransform(dpr, 0, 0, dpr, s.M * dpr, s.M * dpr)
          fx.clearRect(-s.M, -s.M, s.W + 2 * s.M, s.H + 2 * s.M)
          const na = s.nightAmt
          for (const f of s.flies) {
            if (reducedRef.current) continue // 减少动画时飞虫不再游动
            f.a += Math.sin(s.clock * 0.7 + f.ph) * 1.6 * dt
            let vx = Math.cos(f.a) * f.sp
            let vy = Math.sin(f.a) * f.sp * 0.6
            if (na > 0.5 && performance.now() - s.ptr.t < 2500) {
              const dx = s.ptr.x - f.x
              const dy = s.ptr.y - f.y
              const d = Math.hypot(dx, dy)
              if (d < s.W * 0.3 && d > 20) {
                vx += (dx / d) * 22
                vy += (dy / d) * 22
              }
            }
            f.x += vx * dt
            f.y += vy * dt
            if (f.x < -20) f.x = s.W + 20
            if (f.x > s.W + 20) f.x = -20
            if (f.y < s.H * 0.42) f.a = Math.PI / 2
            if (f.y > s.H * 0.97) f.a = -Math.PI / 2
            if (na > 0.02 && s.flySprite) {
              const b = Math.max(0, Math.sin(s.clock * f.bl * 2 + f.ph)) * 0.8 + 0.2
              const sz = (10 + b * 12) * f.z * Math.max(0.7, Math.min(1.3, s.U / 10))
              fx.globalAlpha = na * b
              fx.drawImage(s.flySprite, f.x - sz, f.y - sz, sz * 2, sz * 2)
            }
            if (na < 0.98) {
              fx.globalAlpha = (1 - na) * 0.55
              fx.fillStyle = '#fff8e6'
              fx.beginPath()
              fx.arc(f.x, f.y, 1.3 * f.z, 0, 6.283)
              fx.fill()
            }
          }
          fx.globalAlpha = 1
        }
      }
    }

    s.lastTime = performance.now()
    s.rafId = requestAnimationFrame(frame)

    // 输入事件
    const onPointerMove = (e: PointerEvent) => {
      if (reducedRef.current) return
      const now = performance.now()
      if (e.pointerType === 'mouse' && !s.drag) {
        s.tx = Math.max(-1, Math.min(1, (e.clientX / s.W - 0.5) * 2))
        s.ty = Math.max(-1, Math.min(1, (e.clientY / s.H - 0.5) * 2))
      } else if (s.drag) {
        const dx = (e.clientX - s.drag.x) / (s.W * 0.5)
        const dy = (e.clientY - s.drag.y) / (s.H * 0.5)
        s.tx = Math.max(-1, Math.min(1, s.drag.tx + dx))
        s.ty = Math.max(-1, Math.min(1, s.drag.ty + dy))
      }
      if (s.lastPX !== null) {
        const v = (e.clientX - s.lastPX) / Math.max(8, now - s.lastPT)
        s.tagV += -v * 9
      }
      s.lastPX = e.clientX
      s.lastPT = now
      s.lastInput = now
      const f = Math.pow(7.4 / 8, 1.15) * s.S
      s.ptr.x = e.clientX + s.px * f
      s.ptr.y = e.clientY + s.py * f * 0.55
      s.ptr.t = now
    }

    const onPointerDown = (e: PointerEvent) => {
      s.lastInput = performance.now()
      if (e.pointerType !== 'mouse') {
        s.drag = { x: e.clientX, y: e.clientY, tx: s.tx, ty: s.ty }
      }
    }

    const onPointerUp = () => {
      s.drag = null
    }

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (reducedRef.current) return
      if (e.gamma !== null && e.beta !== null && !s.drag) {
        const tx = Math.max(-1, Math.min(1, e.gamma / 25))
        const ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25))
        s.tx = tx
        s.ty = ty
        s.lastInput = performance.now()
      }
    }

    const onClick = (e: MouseEvent) => {
      if (reducedRef.current) return
      if (e.target === foxBtnRef.current) return
      const f = Math.pow(7.7 / 8, 1.15) * s.S
      leafBurst(e.clientX + s.px * f, e.clientY + s.py * f * 0.55)
      s.tagV += (Math.random() - 0.5) * 30
    }

    // 拖拽窗口时 resize 每秒会来几十次，每次都重建整片森林既掉帧又闪。
    // 用 rAF 合并：一帧内最多重建一次，且只认最后一次的尺寸。
    let resizeRaf = 0
    const onResize = () => {
      if (resizeRaf) return
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0
        build()
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('deviceorientation', onDeviceOrientation)
    stage.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(s.rafId)
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('deviceorientation', onDeviceOrientation)
      stage.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      if (typeof document !== 'undefined') {
        document.body.classList.remove('pf-night')
      }
    }
  }, [build, makeLeaves, leafBurst, landPuff, renderFox])

  return (
    <>
      <div className={`pf-stage ${isNight ? 'pf-night' : ''}`} ref={stageRef} aria-hidden="true">
        {/* 天幕 */}
        <div className="pf-sky" id="pfSky">
          <div className="pf-sky-night" />
          <svg className="pf-sky-grain" aria-hidden="true" focusable="false">
            <rect width="100%" height="100%" fill="url(#pfGrainPat)" />
          </svg>
          <svg className="pf-pins" id="pfPins" aria-hidden="true" focusable="false" />
        </div>

        {/* 悬挂吊杆系统 */}
        <div className="pf-layer" id="pfHang" data-depth="0.4" aria-hidden="true" />

        {/* 九层剪纸堆叠 */}
        <div className="pf-layer pf-cut pf-place" id="pfL1" data-depth="1" style={{ '--i': 0, '--sh': 3 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>
        <div className="pf-layer pf-cut pf-place" id="pfL2" data-depth="2" style={{ '--i': 1, '--sh': 3 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>
        <div className="pf-layer pf-cut pf-place" id="pfL3" data-depth="3" style={{ '--i': 2, '--sh': 4 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>
        <div className="pf-layer pf-cut pf-place" id="pfL4" data-depth="4" style={{ '--i': 3, '--sh': 4 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>
        <div className="pf-layer pf-cut pf-place" id="pfL5" data-depth="5" style={{ '--i': 4, '--sh': 5 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>
        <div className="pf-layer pf-cut pf-place" id="pfL6" data-depth="6" style={{ '--i': 5, '--sh': 6 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>
        <div className="pf-layer pf-cut pf-place" id="pfL7" data-depth="7" style={{ '--i': 6, '--sh': 6 } as React.CSSProperties}>
          <svg focusable="false" aria-hidden="true" />
          <button
            type="button"
            className="pf-fox-btn"
            ref={foxBtnRef}
            onClick={(e) => {
              e.stopPropagation()
              hop()
            }}
            aria-label="散木小狐狸：点击让它跳跃"
          />
        </div>

        {/* 萤火虫画布与落叶图层 */}
        <canvas className="pf-layer" id="pfFlies" ref={canvasRef} data-depth="7.4" aria-hidden="true" />
        <div className="pf-layer" id="pfLeaves" ref={leavesRef} data-depth="7.7" aria-hidden="true" />

        <div className="pf-layer pf-cut pf-place" id="pfL8" data-depth="8" style={{ '--i': 7, '--sh': 7 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>
        <div className="pf-layer pf-cut" id="pfL9" data-depth="2.2" style={{ '--i': 8, '--sh': 9 } as React.CSSProperties} aria-hidden="true">
          <svg focusable="false" />
        </div>

        <div className="pf-vignette" aria-hidden="true" />

        {/* SVG Defs 纹理与滤镜 */}
        <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true" focusable="false">
          <defs>
            <pattern id="pfGrainPat" patternUnits="userSpaceOnUse" width="160" height="160">
              <image id="pfGrainImg" width="160" height="160" href={paperGrainUrl} preserveAspectRatio="none" />
            </pattern>
            <radialGradient id="pfWinGlowGrad">
              <stop offset="0" stopColor="#ffd98a" stopOpacity="0.75" />
              <stop offset="0.45" stopColor="#ffc766" stopOpacity="0.22" />
              <stop offset="1" stopColor="#ffc766" stopOpacity="0" />
            </radialGradient>
            <filter id="pfSoftGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>

      {/* 摇曳的行李吊牌 (Luggage Tag) */}
      <header className={`pf-tag-wrap ${isNight ? 'pf-night' : ''}`} ref={tagWrapRef} aria-hidden="true">
        <span className="pf-tag-string" />
        <div className="pf-tag">
          <svg className="pf-tag-grain" focusable="false">
            <rect width="100%" height="100%" fill="url(#pfGrainPat)" />
          </svg>
          <span className="pf-tag-knot" />
          <span className="pf-tag-hole" />
          <p className="pf-kicker">Plate XVIII · 纸艺小树林</p>
          <h1>解忧<em>森林</em></h1>
          <span className="pf-rule" />
          <p className="pf-sub">九层手工剪纸，一湾慢流，一棵安放情绪的散木。</p>
        </div>
      </header>

      {/* 悬浮控制按钮组 (昼夜切换 / 重新下剪) */}
      {showControls && (
        <nav className={`pf-controls ${isNight ? 'pf-night' : ''}`} aria-label="纸艺舞台控制">
          <button
            type="button"
            className="pf-chip"
            onClick={recut}
            aria-label="重新下剪，生成新林"
            title="重新生成森林剪影"
          >
            <svg className="scissors" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="6" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path d="M8.3 16.2 20 5M8.3 7.8 20 19M13 12h.01" />
              </g>
            </svg>
            <span className="pf-chip-label">重剪</span>
          </button>

          <button
            type="button"
            className="pf-chip"
            onClick={toggleNight}
            aria-pressed={isNight}
            aria-label={isNight ? '切换到白昼' : '切换到静夜'}
            title="切换昼夜与星空吊杆"
          >
            <span className="pf-track" aria-hidden="true">
              <span className="pf-knob">
                <svg className="k-sun" viewBox="-11 -11 22 22" focusable="false">
                  <g fill="#c8642d">
                    <circle r="5.6" />
                    <path d="M0-10 1.6-6.8h-3.2zM0 10l1.6-3.2h-3.2zM-10 0l3.2 1.6v-3.2zM10 0 6.8 1.6v-3.2zM-7 -7l3.4 1.2-2.2 2.2zM7 7 3.6 5.8l2.2-2.2zM7 -7 5.8-3.6 3.6-5.8zM-7 7l1.2-3.4 2.2 2.2z" />
                  </g>
                </svg>
                <svg className="k-moon" viewBox="-11 -11 22 22" focusable="false">
                  <path fill="#f4ead2" d="M3.2-8.6A9 9 0 1 0 8.8 4 7.2 7.2 0 0 1 3.2-8.6z" />
                </svg>
              </span>
            </span>
            <span className="pf-chip-label">{isNight ? '静夜' : '白昼'}</span>
          </button>
        </nav>
      )}
    </>
  )
}
