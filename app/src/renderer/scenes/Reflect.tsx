import { useState } from 'react'
import type { ReflectionCardId } from '../../shared/types'
import type { SessionController } from '../useSession'
import DiscussDrawer from './DiscussDrawer'

const PANELS: Array<[ReflectionCardId, string, string]> = [
  ['guardian', '守护者', '守护者反问：你真正想保护的核心需求或边界是什么？'],
  ['explorer', '探索者', '探索者反问：如果把反对意见当作路标，这里藏着什么新可能？'],
  ['outsider', '局外人', '局外人反问：一年后的你回看今天，会怎么看待这个小插曲？'],
  ['mirror', '折返镜', '重构之镜：换一个更具建设性的思考角度'],
]

export default function Reflect({ s }: { s: SessionController }) {
  const analysis = s.analysis
  const [activeDiscuss, setActiveDiscuss] = useState<{
    perspective: ReflectionCardId
    title: string
    socratic: string
  } | null>(null)

  const handleOpenDiscuss = (perspective: ReflectionCardId, title: string, socratic: string) => {
    setActiveDiscuss({ perspective, title, socratic })
  }

  const handleSaveInsight = (insightText: string) => {
    s.adoptExperiment({
      action: insightText,
      observableCriterion: '在多轮推敲后明确了新的内心边界与行动',
      estimatedMinutes: 5,
    })
  }

  return (
    <div className="reflect-container">
      {/* 第一层：你说过的原话 vs 折返镜读到的前提。
          左边是逐字引用，可核对；右边是模型推断，必须标明可能不准。
          这里原本是一个「客观事实 vs 主观脑补剥离」卡片加一枚「灾难化」标签——
          给用户的想法贴认知扭曲标签就是诊断，PRD §8.1 明令禁止。 */}
      {analysis && (analysis.quotedInput.length > 0 || analysis.assumptions.length > 0) && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: '20px 22px',
            borderLeft: '4px solid #7d9a6a',
            background: 'rgba(255, 252, 246, 0.9)',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              🔍 你说过的原话 vs 折返镜读到的前提
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px 14px', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                📌 你的原话（逐字引用，可核对）
              </span>
              {analysis.quotedInput.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                  {analysis.quotedInput.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>这次没有可引用的原话。</p>
              )}
            </div>

            <div style={{ background: 'rgba(125, 154, 106, 0.08)', padding: '12px 14px', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: '#4d6944', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                💭 折返镜读到的前提
              </span>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--muted)' }}>
                以下是模型的推断，可能不准，你可以不认。
              </p>
              {analysis.assumptions.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                  {analysis.assumptions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>这次模型没有给出可核对的前提。</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 第二层：苏格拉底反问 + 三视角与折返镜 */}
      {PANELS.map(([key, defaultTitle, defaultSocratic]) => {
        const socratic = analysis?.socraticQuestions?.[key] || defaultSocratic
        return (
          <div className="card" key={key} style={{ marginBottom: 14, padding: '18px 20px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{defaultTitle}</span>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#3d6148', fontWeight: 600 }}>💡 {socratic}</p>
              </div>
              <button
                type="button"
                className="chip"
                onClick={() => handleOpenDiscuss(key, defaultTitle, socratic)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(74, 141, 92, 0.12)',
                  color: '#2d6a3f',
                  fontWeight: 600,
                  border: '1px solid rgba(74, 141, 92, 0.3)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                <span>💬 深入推敲</span>
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
              {s.cards[key] || '……'}
            </p>
          </div>
        )
      })}

      {/* 第三层：行动微实验建议。只渲染模型真的产出的内容——没有就不出现。 */}
      {analysis?.microExperiment && (
        <div
          className="card"
          style={{
            margin: '20px 0',
            padding: '20px 22px',
            borderLeft: '4px solid #5a7d5a',
            background: 'rgba(244, 250, 244, 0.92)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>🧪</span>
            <strong style={{ fontSize: 15, color: '#2d4b32' }}>一个可撤回的小建议</strong>
            {analysis.microExperiment.estimatedMinutes && (
              <span className="chip" style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}>
                约 {analysis.microExperiment.estimatedMinutes} 分钟
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 4px', fontSize: 14, fontWeight: 600 }}>{analysis.microExperiment.action}</p>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>
            判据：{analysis.microExperiment.observableCriterion}
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: 'var(--muted)' }}>
            这只是建议，不是处方。你可以改写它，也可以完全不采纳。
          </p>
          <button className="primary" onClick={() => s.adoptExperiment(analysis.microExperiment!)}>
            采纳微实验留年轮
          </button>
        </div>
      )}

      {/* 底部导航 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button className="primary" onClick={() => s.go('save')}>
          留下一圈年轮
        </button>
        <button className="ghost" onClick={() => s.go('rest')}>
          先歇一会儿
        </button>
        <button className="ghost" onClick={() => s.go('express')}>
          暂时不留
        </button>
      </div>

      {/* 专属深聊抽屉 */}
      {activeDiscuss && (
        <DiscussDrawer
          isOpen={Boolean(activeDiscuss)}
          onClose={() => setActiveDiscuss(null)}
          perspective={activeDiscuss.perspective}
          perspectiveTitle={activeDiscuss.title}
          initialQuestion={activeDiscuss.socratic}
          sessionId={s.sessionId}
          onSaveInsight={handleSaveInsight}
        />
      )}
    </div>
  )
}
