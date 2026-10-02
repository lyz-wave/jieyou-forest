import type { SessionController } from '../useSession'

/** 承接之后的当下空间。两条路径在这里同时出现，分流发生在承接之后。 */
export default function Space({ s }: { s: SessionController }) {
  return (
    <>
      {s.banner && <div className="banner">{s.banner}</div>}

      {/* 跨时空年轮共鸣卡片 */}
      {s.resonance && (
        <div
          className="card"
          data-testid="resonance-card"
          style={{
            marginBottom: 16,
            padding: '16px 18px',
            borderLeft: '4px solid #6d8d5c',
            background: 'rgba(240, 248, 238, 0.94)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>🌿</span>
              <strong style={{ fontSize: 13, color: '#3d5735' }}>跨时空年轮共鸣</strong>
            </div>
            <span
              className="chip"
              style={{
                fontSize: 10,
                padding: '2px 6px',
                height: 'auto',
                background: 'rgba(109, 141, 92, 0.15)',
                color: '#3d5735',
                fontWeight: 600,
              }}
            >
              相似度 {Math.round(s.resonance.similarityScore * 100)}%
            </span>
          </div>
          <p style={{ margin: '4px 0 8px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            {s.resonance.message}
          </p>
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: 8,
              borderLeft: '3px solid #6d8d5c',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 10,
            }}
          >
            “{s.resonance.userNote}”
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="ghost"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={s.openTree}
            >
              查看那圈年轮
            </button>
          </div>
        </div>
      )}

      <div className="card">{s.receive || '……'}</div>

      <div className="row">
        {s.caps.canRest && <button className="primary" onClick={() => s.choose('rest')}>先歇一会儿</button>}
        {s.caps.canReflect ? (
          <button className="ghost" onClick={() => s.choose('reflect')}>陪我想一想</button>
        ) : (
          <span className="muted">这次先不进入思考。你可以随时去休息。</span>
        )}
        <button className="ghost" onClick={() => s.go('express')}>今天先到这里</button>
      </div>
      {!s.banner && (
        <button className="ghost" onClick={s.retryReceive}>重试这次回应</button>
      )}
    </>
  )
}
