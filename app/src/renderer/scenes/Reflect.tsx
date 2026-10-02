import type { ReflectionCardId } from '../../shared/types'
import type { SessionController } from '../useSession'

const PANELS: Array<[ReflectionCardId, string, string]> = [
  ['guardian', '守护者', '守护者反问：你真正想保护的核心需求或边界是什么？'],
  ['explorer', '探索者', '探索者反问：如果把反对意见当作路标，这里藏着什么新可能？'],
  ['outsider', '局外人', '局外人反问：一年后的你回看今天，会怎么看待这个小插曲？'],
  ['mirror', '折返镜', '重构之镜：换一个更具建设性的思考角度'],
]


export default function Reflect({ s }: { s: SessionController }) {
  const analysis = s.analysis

  return (
    <div className="reflect-container">
      {/* 第一层：事实与灾难化脑补剥离 */}
      {analysis && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: '20px 22px',
            borderLeft: '4px solid #c8642d',
            background: 'rgba(255, 252, 246, 0.9)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              🔍 客观事实 vs 主观脑补剥离
            </span>
            {analysis.distortionBadge && (
              <span className="chip" style={{ background: 'rgba(200, 100, 45, 0.15)', color: '#b04825', fontWeight: 600 }}>
                {analysis.distortionBadge}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px 14px', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                📌 客观事实发生
              </span>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                {analysis.objectiveFact}
              </p>
            </div>
            <div style={{ background: 'rgba(200, 100, 45, 0.05)', padding: '12px 14px', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: '#b04825', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                💭 主观脑补推论
              </span>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                {analysis.subjectiveAssumption}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 第二层：苏格拉底反问 + 三视角与折返镜 */}
      {PANELS.map(([key, defaultTitle, defaultSocratic]) => {
        const socratic = analysis?.socraticQuestions?.[key as keyof typeof analysis.socraticQuestions] || defaultSocratic
        return (
          <div className="card" key={key} style={{ marginBottom: 14, padding: '18px 20px' }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                {defaultTitle}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#3d6148', fontWeight: 600 }}>
                💡 {socratic}
              </p>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
              {s.cards[key] || '……'}
            </p>
          </div>
        )
      })}

      {/* 第三层：行动微实验建议 */}
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
            <strong style={{ fontSize: 15, color: '#2d4b32' }}>5 分钟微行动实验建议</strong>
            {analysis.microExperiment.estimatedMinutes && (
              <span className="chip" style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}>
                约 {analysis.microExperiment.estimatedMinutes} 分钟
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 4px', fontSize: 14, fontWeight: 600 }}>
            {analysis.microExperiment.action}
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--muted)' }}>
            判据：{analysis.microExperiment.observableCriterion}
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
    </div>
  )
}

