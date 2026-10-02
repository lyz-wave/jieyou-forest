// 离线烘水彩底图：纯数值生成 + 手写 PNG 编码，无第三方依赖。
//
//   node tools/bake-watercolor.cjs src/renderer/watercolor
//
// 素材是烘出来的，不是画出来的——所以要改质感就改这个文件再跑一次，
// 别去手改 PNG。几条踩过的坑写在对应位置：
//   · 噪声格点采样必须钳制而不是取模，否则频率 >1 时留下硬缝
//   · 湿边要从"模糊过的"梯度场取，直接对浓度场求梯度会得到尖刺硬块
//   · 模糊函数不能用滑动窗口 + 边界钳制，累加器会漂移出明暗带
//   · 预览合成必须双线性采样，最近邻缩图会凭空造出"像素化碎点"
const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

const OUT = process.argv[2]
fs.mkdirSync(OUT, { recursive: true })

// ---------------- PNG ----------------
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    let c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0)
  return Buffer.concat([len, td, crc])
}
function encodePNG(w, h, channels, data) {
  const stride = w * channels
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------- 噪声 ----------------
function lattice(seed, n) {
  const g = new Float32Array(n * n)
  let s = (seed >>> 0) || 1
  for (let i = 0; i < g.length; i++) {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0
    g[i] = s / 4294967296
  }
  return { n, g }
}
function sample(L, u, v) {
  const n = L.n
  const x = u * n, y = v * n
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  // 钳制而不是取模。取模只在采样坐标恰好落在 [0,n) 内时才连续；
  // 一旦调用方写了 u*2.6 这种频率放大，x 越过 n 就会从格子 199 跳回 0，
  // 在固定的 x 位置留下一道硬缝——那就是"带直角的灰块"。
  const ci = (v) => (v < 0 ? 0 : v > n - 1 ? n - 1 : v)
  const at = (a, b) => L.g[ci(b) * n + ci(a)]
  const p0 = at(x0, y0), p1 = at(x0 + 1, y0), p2 = at(x0, y0 + 1), p3 = at(x0 + 1, y0 + 1)
  return (p0 * (1 - sx) + p1 * sx) * (1 - sy) + (p2 * (1 - sx) + p3 * sx) * sy
}
function fbm(seed, baseGrid, octaves, gain) {
  const layers = []
  for (let o = 0; o < octaves; o++) layers.push(lattice(seed + o * 7919, baseGrid << o))
  return (u, v) => {
    let sum = 0, amp = 1, norm = 0
    for (let o = 0; o < octaves; o++) { sum += amp * sample(layers[o], u, v); norm += amp; amp *= gain }
    return sum / norm
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }

/** 可分离盒式模糊。用来把尖刺状的梯度场变成连续的湿边。 */
function boxBlur(src, w, h, r) {
  if (r <= 0) return src
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const win = 2 * r + 1
  const cx = (i) => (i < 0 ? 0 : i >= w ? w - 1 : i)
  const cy = (i) => (i < 0 ? 0 : i >= h ? h - 1 : i)
  // 直接用窗口求和。滑动窗口版本在边界用钳制索引，
  // 累加器会把越界的重复采样算进去而漂移，形成系统性明暗带。
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let i = -r; i <= r; i++) s += src[y * w + cx(x + i)]
      tmp[y * w + x] = s / win
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let i = -r; i <= r; i++) s += tmp[cy(y + i) * w + x]
      out[y * w + x] = s / win
    }
  }
  return out
}

// ---------------- 颜料 ----------------
const MOSS = [47, 82, 51]     // 墨绿
const CYAN = [61, 107, 112]   // 苍青
const OCHRE = [169, 113, 63]  // 暖赭
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/**
 * 烘一张晕染。
 * 三张近景共用同一套 body 骨架、只错开 warp 相位——
 * 否则交叉淡化会变成两张无关的图在对溶，而不是同一片颜料在化开。
 *
 * 湿边必须从"模糊过的"梯度场取。直接对浓度场求梯度会得到尖刺状硬块，
 * 看起来像像素噪点或遮罩残留，而不是水彩干燥时颜料被推到边界的那道柔痕。
 */
const WARP_SEED = 1300        // 三个近景状态共用同一个扭曲场 = 同一片颜料
const CREEP_AMOUNT = 0.055    // 每个状态只额外加这么点"爬行"位移

function bakeWash({ w, h, creepSeed, maxAlpha, centerRelief, edgeStrength, bodySeed }) {
  const warpA = fbm(WARP_SEED + 101, 5, 4, 0.55)
  const warpB = fbm(WARP_SEED + 211, 5, 4, 0.55)
  const creepX = creepSeed ? fbm(creepSeed + 11, 6, 3, 0.55) : null
  const creepY = creepSeed ? fbm(creepSeed + 29, 6, 3, 0.55) : null
  const body = fbm(bodySeed, 3, 5, 0.55)
  const fine = fbm(bodySeed + 911, 12, 3, 0.55)
  // 只保留低频起伏（约 16 CSS 像素一格），不放逐像素颗粒。
  const gran = fbm((creepSeed || 1) + 307, 42, 1, 0.5)
  const tooth = fbm((creepSeed || 1) + 601, 60, 1, 0.5)
  const tint = fbm(1709, 3, 3, 0.5)

  // 1) 浓度场
  let conc = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const v = y / h
    for (let x = 0; x < w; x++) {
      const u = x / w
      // 骨架扭曲三态共用，只叠一点点各不相同的爬行位移。
      // 若三态各用一个完全不同的扭曲场，交叉淡化会变成两张无关的图在对溶。
      const cx = creepX ? CREEP_AMOUNT * (creepX(u, v) - 0.5) : 0
      const cy = creepY ? CREEP_AMOUNT * (creepY(u, v) - 0.5) : 0
      const wx = clamp(u + 0.19 * (warpA(u, v) - 0.5) + cx, 0, 0.9999)
      const wy = clamp(v + 0.19 * (warpB(u, v) - 0.5) + cy, 0, 0.9999)
      let c = smooth(0.41, 0.60, body(wx, wy)) * 0.82
            + smooth(0.47, 0.70, fine(wx, wy)) * 0.34
      c = clamp(c, 0, 1)
      const d = Math.min(1, Math.hypot(u - 0.5, v - 0.5) / 0.6)
      c *= 0.34 + 0.66 * smooth(0.24, 1.0, d)
      c *= 1 - centerRelief * (1 - smooth(0.12, 0.72, d))
      conc[y * w + x] = c
    }
  }
  conc = boxBlur(conc, w, h, 1)

  // 2) 湿边：从模糊后的梯度取，再做一次模糊变成连续的柔痕
  let edge = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const gx = (conc[i + (x < w - 1 ? 1 : 0)] - conc[i - (x > 0 ? 1 : 0)]) * 0.5
      const gy = (conc[i + (y < h - 1 ? w : 0)] - conc[i - (y > 0 ? w : 0)]) * 0.5
      edge[i] = smooth(0.004, 0.055, Math.hypot(gx, gy))
    }
  }
  edge = boxBlur(edge, w, h, 3)

  // 3) 沉积 + 上色
  const data = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    const v = y / h
    for (let x = 0; x < w; x++) {
      const u = x / w
      const i = y * w + x
      let a = conc[i] + edge[i] * edgeStrength * (1 - conc[i])
      // 颗粒刻意压到很轻：高频噪声在任何缩放下都会变成锯齿，
      // 水彩的"沉积"应当靠中频的深浅变化，而不是靠逐像素的噪点。
      a *= 0.94 + 0.12 * gran(u, v)
      a *= 0.975 + 0.05 * tooth(u, v)
      a = clamp(a, 0, 1) * maxAlpha

      const t = clamp(tint(u, v) * 1.25 - 0.12, 0, 1)
      let col = mix(MOSS, CYAN, t)
      const och = smooth(0.54, 1.05, u * 0.72 + (1 - v) * 0.52) * 0.62
      col = mix(col, OCHRE, och)

      const o = i * 4
      data[o] = Math.round(clamp(col[0], 0, 255))
      data[o + 1] = Math.round(clamp(col[1], 0, 255))
      data[o + 2] = Math.round(clamp(col[2], 0, 255))
      data[o + 3] = Math.round(clamp(a, 0, 1) * 255)
    }
  }
  return { w, h, data }
}

function bakePaper(size) {
  const fib = fbm(9001, 12, 5, 0.55)
  const tooth = fbm(9103, 64, 2, 0.5)
  const data = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const f = fib(u, v)                  // 纤维走向
      const t = tooth(u, v)
      let g = 243 + (f - 0.5) * 40 + (t - 0.5) * 26
      g = clamp(g, 202, 255)
      const o = (y * size + x) * 3
      data[o] = Math.round(g * 1.004)
      data[o + 1] = Math.round(g)
      data[o + 2] = Math.round(g * 0.982)
    }
  }
  return { w: size, h: size, data }
}

// ---------------- 预览合成 ----------------
/**
 * 双线性采样。
 * 之前这里用的是最近邻（Math.floor）：预览把 1770×1350 的晕染缩到 1180×900，
 * 最近邻缩小 = 丢掉约三分之一的像素，产生"灰色碎点、像素化"；
 * 纸纹 512px 被拉成 5.5px 一格，产生"方点、直角碎块"。
 * 我为此改了三轮水彩算法——伪影其实出在预览这一步。
 */
function sampler(img) {
  const ch = img.data.length / (img.w * img.h)
  const at = (a, b) => {
    const ax = a < 0 ? 0 : a > img.w - 1 ? img.w - 1 : a
    const ay = b < 0 ? 0 : b > img.h - 1 ? img.h - 1 : b
    const i = (ay * img.w + ax) * ch
    return [img.data[i], img.data[i + 1], img.data[i + 2], ch === 4 ? img.data[i + 3] / 255 : 1]
  }
  return (u, v) => {
    const x = clamp(u, 0, 0.9999999) * img.w - 0.5
    const y = clamp(v, 0, 0.9999999) * img.h - 0.5
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const fx = x - x0, fy = y - y0
    const p00 = at(x0, y0), p10 = at(x0 + 1, y0), p01 = at(x0, y0 + 1), p11 = at(x0 + 1, y0 + 1)
    const o = [0, 0, 0, 0]
    for (let k = 0; k < 4; k++) {
      o[k] = (p00[k] * (1 - fx) + p10[k] * fx) * (1 - fy) + (p01[k] * (1 - fx) + p11[k] * fx) * fy
    }
    return o
  }
}

function preview(w, h, far, near, paper, outPath) {
  const data = Buffer.alloc(w * h * 3)
  const sFar = sampler(far), sNear = sampler(near), sPaper = sampler(paper)
  const over = (dst, src, a) => {
    dst[0] += (src[0] - dst[0]) * a
    dst[1] += (src[1] - dst[1]) * a
    dst[2] += (src[2] - dst[2]) * a
  }
  for (let y = 0; y < h; y++) {
    const v = y / h
    for (let x = 0; x < w; x++) {
      const u = x / w
      const px = [244, 241, 231]
      const f = sFar(u, v)
      over(px, f, f[3] * 0.9)
      const n = sNear(u, v)
      over(px, n, n[3])
      const p = sPaper(u, v)
      const k = (p[0] + p[1] + p[2]) / 3 / 255
      px[0] *= k; px[1] *= k; px[2] *= k
      const o = (y * w + x) * 3
      data[o] = Math.round(clamp(px[0], 0, 255))
      data[o + 1] = Math.round(clamp(px[1], 0, 255))
      data[o + 2] = Math.round(clamp(px[2], 0, 255))
    }
  }
  fs.writeFileSync(outPath, encodePNG(w, h, 3, data))
  return data
}

// ---------------- 跑 ----------------
// 按 1 倍尺寸出图就够了。
// 这张背景本质是柔的：它只有低频的晕染与湿边，没有高频细节，
// 所以高分辨率什么也买不到，只买到显存和锯齿。
// （曾经按 2x 出过 2660x2020，5 张图约 107MB 显存，启动时卡了 3.4 秒，
//   而逐像素颗粒在低不透明度下被 8 位量化成肉眼可见的斑点。）
const W = 1330, H = 1010
const t0 = Date.now()
const BODY_SEED = 4242

const far = bakeWash({ w: W, h: H, creepSeed: 0, maxAlpha: 0.5, centerRelief: 0.76, edgeStrength: 1.5, bodySeed: BODY_SEED })
fs.writeFileSync(path.join(OUT, 'far.png'), encodePNG(W, H, 4, far.data))
console.log('far.png', ((Date.now() - t0) / 1000).toFixed(1) + 's')

const states = []
for (let s = 0; s < 3; s++) {
  const w2 = bakeWash({ w: W, h: H, creepSeed: 2101 + s * 102, maxAlpha: 0.42, centerRelief: 0.8, edgeStrength: 1.9, bodySeed: BODY_SEED })
  states.push(w2)
  fs.writeFileSync(path.join(OUT, 'near-' + 'abc'[s] + '.png'), encodePNG(W, H, 4, w2.data))
  console.log('near-' + 'abc'[s] + '.png', ((Date.now() - t0) / 1000).toFixed(1) + 's')
}

const paper = bakePaper(1024)
fs.writeFileSync(path.join(OUT, 'paper.png'), encodePNG(1024, 1024, 3, paper.data))
console.log('paper.png', ((Date.now() - t0) / 1000).toFixed(1) + 's')

// 合成预览是给人看的评审件，不是应用素材：写到子目录，不参与打包。
const PREVIEW_DIR = path.join(OUT, 'preview')
fs.mkdirSync(PREVIEW_DIR, { recursive: true })
for (let s = 0; s < 3; s++) {
  preview(1180, 900, far, states[s], paper, path.join(PREVIEW_DIR, 'preview-' + 'abc'[s] + '.png'))
}
console.log('preview 三张完成', ((Date.now() - t0) / 1000).toFixed(1) + 's')

// 相邻像素差 = 高频颗粒强度。数值越大，任何下采样都会产生锯齿。
function highFreq(data) {
  let s = 0, n = 0
  const N = data.length / 4
  for (let i = 0; i < N - 1; i++) { s += Math.abs(data[i * 4 + 3] - data[(i + 1) * 4 + 3]); n++ }
  return s / n
}
console.log('近景 alpha 的逐像素差（越小越不容易在缩放下锯齿）:', highFreq(states[0].data).toFixed(2))

// 三个状态要"同中有变"：差异太小则交叉淡化看不出在动，太大则像两张无关的图对溶
const meanAlpha = (d) => { let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s / (d.length / 4) / 255 }
function diff(a, b) { let s = 0, n = 0; for (let i = 3; i < a.length; i += 4) { s += Math.abs(a[i] - b[i]); n++ } return s / n }
const m = meanAlpha(states[0].data)
console.log('近景平均不透明度:', (m * 100).toFixed(1) + '%')
console.log('状态间平均差: a-b ' + diff(states[0].data, states[1].data).toFixed(2) + '  b-c ' + diff(states[1].data, states[2].data).toFixed(2) + '  a-c ' + diff(states[0].data, states[2].data).toFixed(2) + '  （单位/255；占平均不透明度的 ' + (diff(states[0].data, states[1].data) / 255 / Math.max(m, 1e-6) * 100).toFixed(0) + '%）')