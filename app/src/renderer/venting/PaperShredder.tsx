import { useState } from 'react'

export interface PaperShredderProps {
  text: string
  onCalmed: () => void
}

export default function PaperShredder({ text, onCalmed }: PaperShredderProps) {
  const [phase, setPhase] = useState<'flat' | 'crumpled' | 'shredded'>('flat')
  const [crumpleProgress, setCrumpleProgress] = useState(0)

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

  const handleTear = () => {
    setPhase('shredded')
    onCalmed()
  }

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
          <div className="paper-ball-container" onClick={handleTear}>
            <svg viewBox="-30 -30 60 60" width="80" height="80" className="paper-ball-svg">
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
            <button className="primary" onClick={handleTear}>
              用力撕碎吹散
            </button>
          </div>
        </div>
      )}

      {phase === 'shredded' && (
        <div className="shred-stage confetti-active">
          <div className="shred-burst">
            {[...Array(12)].map((_, i) => (
              <span key={i} className={`shred-flake shred-flake-${i}`} />
            ))}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, margin: '20px 0 0' }}>
            撕裂随风消散... 森林替你吹走了
          </p>
        </div>
      )}
    </div>
  )
}
