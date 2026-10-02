import { useState } from 'react'

export interface WoodChippingProps {
  onCalmed: () => void
}

export default function WoodChipping({ onCalmed }: WoodChippingProps) {
  const [chipsCount, setChipsCount] = useState(0)
  const [chips, setChips] = useState<number[]>([])

  const handleChip = () => {
    setChipsCount((c) => c + 1)
    setChips((list) => [...list.slice(-6), Date.now()])
  }

  return (
    <div className="card wood-chipping-box" style={{ padding: '24px 20px', textAlign: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          🪵 木桩凿削 · 削去负重
        </span>
        <button
          className="ghost"
          style={{ padding: '4px 10px', fontSize: 12, height: 'auto' }}
          onClick={onCalmed}
        >
          好受些了
        </button>
      </div>

      <div
        style={{ margin: '14px 0', position: 'relative', height: 160, overflow: 'hidden', cursor: 'crosshair' }}
        onClick={handleChip}
      >
        {/* 木桩截面与凿痕 */}
        <svg viewBox="-50 -50 100 100" width="130" height="130" className="wood-stump-svg">
          {/* 外皮 */}
          <ellipse cx="0" cy="0" rx="46" ry="40" fill="#6d543e" stroke="#4a3726" strokeWidth="2.5" />
          {/* 木心 */}
          <ellipse cx="0" cy="0" rx="38" ry="33" fill="#e2cda9" stroke="#bfaa88" strokeWidth="1.2" />
          <ellipse cx="0" cy="0" rx="28" ry="24" fill="#dfc7a0" stroke="#bfaa88" strokeWidth="0.8" />
          <ellipse cx="0" cy="0" rx="16" ry="14" fill="#d9be94" stroke="#bfaa88" strokeWidth="0.6" />
          <ellipse cx="0" cy="0" rx="5" ry="4.5" fill="#a8895b" />
          {/* 随凿削增加的切痕 */}
          {chipsCount > 0 && <path d="M-22,-14 L18,12" stroke="#5a422d" strokeWidth="2" strokeLinecap="round" />}
          {chipsCount > 2 && <path d="M-10,18 L24,-16" stroke="#5a422d" strokeWidth="2" strokeLinecap="round" />}
          {chipsCount > 4 && <path d="M-28,4 L12,24" stroke="#5a422d" strokeWidth="2.5" strokeLinecap="round" />}
        </svg>

        {/* 飞溅木屑 */}
        {chips.map((t, idx) => (
          <span key={t} className={`wood-chip-flake wood-chip-${idx % 4}`} />
        ))}

        <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0 }}>
          <span className="chip" style={{ fontSize: 12, background: 'rgba(0,0,0,0.06)' }}>
            已削除负重：{chipsCount} 层 {chipsCount >= 6 ? '（木纹透亮）' : ''}
          </span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 16px' }}>
        敲击凿除负重，将紧绷的刺痛一层层削为纯净的木屑飞散
      </p>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="primary" onClick={handleChip}>
          挥凿削木
        </button>
        <button className="ghost" onClick={onCalmed}>
          心里好受些了
        </button>
      </div>
    </div>
  )
}
