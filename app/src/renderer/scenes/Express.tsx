import { useEffect, useState } from 'react'
import type { SessionController } from '../useSession'
import VoiceInputButton from '../voice/VoiceInputButton'

const PRIVACY_SEEN_KEY = 'jieyou_seen_privacy_notice'

/**
 * 首页：一句话 + 一个输入框 + 一个按钮。
 *
 * 这里原本还有：副标题、一排七个情绪标签、一句"标签只是给你自己看的"、以及一个语音按钮。
 * 全删了，理由各不相同：
 *   · 情绪标签——用户点了之后对任何事都没有影响，界面上让人做一个不影响结果的选择，
 *     比冗余更糟；而且系统不该对用户的感受下判断（见 PRD §16 第 5 条）。
 *   · 副标题——和主标题在说同一件事，且是品牌口号语气。
 *   · 那行说明——前半句在承认标签没用；后半句"默认不保存原文"是重要信息，
 *     但该出现在用户真正要保存的那一刻，不是在门口念免责声明。
 *   · 语音按钮——文案不实（Web Speech API 会把音频送到云端识别服务）、
 *     Electron 打包版通常不可用、且 PRD 非目标明写不做语音采集。
 */
export default function Express({ s }: { s: SessionController }) {
  // 隐私信息要在用户做决定的那一刻说，不是在门口念免责声明。
  // 所以它只出现一次，之后由"保存年轮"那一步的字段清单接手。
  const [showPrivacy, setShowPrivacy] = useState(false)
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(PRIVACY_SEEN_KEY)) {
        setShowPrivacy(true)
      }
    } catch {}
  }, [])
  const handleVoiceTranscript = (text: string) => {
    s.setInput(s.input ? s.input + ' ' + text : text)
  }

  const dismissPrivacy = () => {
    try {
      localStorage.setItem(PRIVACY_SEEN_KEY, '1')
    } catch {}
    setShowPrivacy(false)
  }

  return (
    <>
      <h1>今天想放下的，是心事，还是事情？</h1>
      <div style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
        <textarea
          value={s.input}
          maxLength={2000}
          placeholder="写一句就好，不用讲完整"
          onChange={(e) => s.setInput(e.target.value)}
          style={{ paddingBottom: 42 }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            size="sm"
            title="点击麦克风语音输入（录音发往你自己配置的识别端点）"
          />
        </div>
      </div>
      <div className="row">
        {/* 请求进行中必须禁用：连点会创建多个会话，而两段回应的字会交织在一起。
            文案同时变掉——虽然切场景是毫秒级的，IPC 冷启动时仍会短暂看到它。 */}
        <button className="primary" onClick={s.submit} disabled={!s.input.trim() || s.awaiting}>
          {s.awaiting ? '正在接住…' : '说完了'}
        </button>
      </div>
      {s.notice && <p className="muted">{s.notice}</p>}

      {/* 到期提示。**只在真的有到期年轮时出现**，不是常驻——首页要保持极简。
          这一行是在还债：用户被要求约定一个复盘日，而在此之前，
          到了那天什么都不会发生，因为根本没人读这份约定。 */}
      {s.due.length > 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          你有 {s.due.length} 圈年轮到期了。
          <button
            type="button"
            onClick={s.openTree}
            style={{ marginLeft: 6, border: 0, background: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: 0 }}
          >
            去看看
          </button>
        </p>
      )}
      {showPrivacy && (
        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
          数据只存在这台电脑上，明文、不加密。
          <button
            type="button"
            onClick={dismissPrivacy}
            style={{ marginLeft: 8, border: 0, background: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 11, padding: 0 }}
          >
            知道了
          </button>
        </p>
      )}
    </>
  )
}
