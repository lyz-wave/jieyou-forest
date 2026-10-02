import { useState } from 'react'
import type { SessionController } from '../useSession'
import DiscussDrawer from './DiscussDrawer'

/** 承接之后的当下空间。两条路径在这里同时出现，分流发生在承接之后。 */
export default function Space({ s }: { s: SessionController }) {
  const [receivingOpen, setReceivingOpen] = useState(false)

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

      {/* 等待期不是"……"，是三条呼吸的横线——像一句还没写完的话。
          刻意不做进度条：进度条天然承诺"快好了"，而模型可能要十几秒，
          一个卡在 90% 的进度条比什么都不显示更让人烦躁。 */}
      <div className="card">
        {s.receive ? (
          s.receive
        ) : s.awaiting ? (
          <>
            <div className="breath" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
              正在接住
            </p>
          </>
        ) : (
          '……'
        )}
      </div>

      {/* 看完承接之后，第一个真实需求往往不是"下一步去哪"，而是
          「我还有一点没说」或「你理解错了」。这里给一个**只承接、不检验**的对话入口：
          它只回应与澄清，不提反问、不检验前提，因此不构成认知挑战，也就不需要同意记录。
          而「陪我想一想」那条路仍然要过同意门槛——门禁在主进程，界面绕不过去。 */}
      {s.receive && !s.awaiting && (
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="ghost" onClick={() => setReceivingOpen(true)}>还想说点什么</button>
        </div>
      )}

      <div className="row">
        {s.caps.canRest && <button className="primary" onClick={() => s.choose('rest')}>先歇一会儿</button>}
        {s.caps.canReflect ? (
          <button className="ghost" onClick={() => s.choose('reflect')}>陪我想一想</button>
        ) : (
          <span className="muted">这次先不进入思考。你可以随时去休息。</span>
        )}
        <button className="ghost" onClick={() => s.go('express')}>今天先到这里</button>
      </div>
      {/* 重试要在**兜底之后**出现。原来写的是 {!s.banner && ...}——
          而横幅恰恰是模型失败、切了兜底稿时才出现的，
          于是最该重试的那一刻按钮消失了，与 PRD §10「45 秒超时提示重试」正相反。 */}
      {s.banner && (
        <button className="ghost" onClick={s.retryReceive} disabled={s.awaiting}>重试这次回应</button>
      )}

      <DiscussDrawer
        isOpen={receivingOpen}
        onClose={() => setReceivingOpen(false)}
        thread="receiving"
        threadTitle="接着说"
        initialQuestion=""
        sessionId={s.sessionId}
        mode="receiving"
        onSaveInsight={(insightText) =>
          s.adoptExperiment({
            action: insightText,
            observableCriterion: '把想说的说完了',
            estimatedMinutes: 5,
          })
        }
      />
    </>
  )
}
