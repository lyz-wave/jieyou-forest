import { useState, useEffect, useRef, useCallback } from 'react'
import type { DiscussMessage, DiscussMode, DiscussThread } from '../../shared/ipc'
import VoiceInputButton from '../voice/VoiceInputButton'

interface DiscussDrawerProps {
  isOpen: boolean
  onClose: () => void
  thread: DiscussThread
  threadTitle: string
  initialQuestion: string
  sessionId: string
  /**
   * challenge（默认）：认知挑战，主进程要求同意记录。
   * receiving：只承接与澄清，不检验前提，不需要同意。
   * 这里只是把模式传给主进程；**门禁在主进程**，界面改不了它的判定。
   */
  mode?: DiscussMode
  onSaveInsight: (insightText: string) => void
}

export default function DiscussDrawer({
  isOpen,
  onClose,
  thread,
  threadTitle,
  initialQuestion,
  sessionId,
  mode = 'challenge',
  onSaveInsight,
}: DiscussDrawerProps) {
  const isReceiving = mode === 'receiving'
  const [messages, setMessages] = useState<DiscussMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // 初始化对话历史，使用苏格拉底初问作为首条陪伴引言
  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          role: 'assistant',
          content:
            initialQuestion ||
            (isReceiving
              ? '我们接着刚才的说。你想补充什么？'
              : `我是【${threadTitle}】视角。让我们一起慢下来，看看这里藏着什么。`),
        },
      ])
      setInputText('')
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [isOpen, thread, threadTitle, initialQuestion, isReceiving])

  // 监听流式返回
  useEffect(() => {
    if (!isOpen) return
    const unsubscribe = window.forest.onDiscussionDelta((chunk) => {
      if (chunk.thread !== thread) return
      if (!chunk.done) {
        setStreamingContent((prev) => prev + chunk.delta)
      } else {
        // 完成一条回复
        setIsStreaming(false)
        setStreamingContent((final) => {
          const total = (final + (chunk.delta || '')).trim()
          if (total) {
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role === 'user') {
                return [...prev, { role: 'assistant', content: total }]
              }
              return prev
            })
          }
          return ''
        })
      }
    })
    return () => unsubscribe()
  }, [isOpen, thread])

  // 自动滚动至最新消息
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isStreaming) return
    const userQuery = inputText.trim()
    const newHistory = [...messages, { role: 'user' as const, content: userQuery }]
    setMessages(newHistory)
    setInputText('')
    setIsStreaming(true)
    setStreamingContent('')

    try {
      const res = await window.forest.discuss({
        sessionId,
        thread,
        threadTitle,
        userQuery,
        history: messages,
        mode,
      })
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.error || '未能继续对话，请检查网络或设置。' },
        ])
        setIsStreaming(false)
      } else if (res.reply) {
        setIsStreaming(false)
        setStreamingContent('')
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'user') {
            return [...prev, { role: 'assistant', content: res.reply! }]
          }
          return prev
        })
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err.message || '对话发生异常' },
      ])
      setIsStreaming(false)
    }
  }, [inputText, isStreaming, messages, sessionId, thread, threadTitle])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 语音输入识别追加
  const handleVoiceTranscript = (text: string) => {
    setInputText((prev) => (prev ? prev + ' ' : '') + text)
  }

  // 提取提炼顿悟并留存年轮
  const handleCaptureInsight = () => {
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant')
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const insight =
      lastUserMsg?.content
        ? `【${threadTitle}推敲】${lastUserMsg.content}`
        : lastAssistantMsg?.content || `来自【${threadTitle}】的启发思考`
    onSaveInsight(insight)
    onClose()
  }

  if (!isOpen) return null

  const userTurnCount = messages.filter((m) => m.role === 'user').length
  const showConvergenceCard = userTurnCount >= 3

  return (
    <div
      className="discuss-drawer-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 24, 22, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9998,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="discuss-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          height: '100%',
          background: 'rgba(255, 252, 245, 0.95)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          borderLeft: '1px solid rgba(220, 205, 185, 0.65)',
        }}
      >
        {/* 顶部标题栏 */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(200, 185, 165, 0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>
                thread === 'receiving' ? '💬' : thread === 'guardian' ? '🌲' : thread === 'explorer' ? '🧭' : thread === 'outsider' ? '🕊️' : '🪞'
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {isReceiving ? '接着说' : threadTitle + ' · 深度推敲'}
              </h3>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              {isReceiving
                ? '只回应，不检验你的想法 · 退出即焚（ADR-0002 纯内存驻留）'
                : '苏格拉底式反思 · 退出即焚（ADR-0002 纯内存驻留）'}
            </p>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={onClose}
            aria-label="关闭讨论"
            style={{ padding: '6px 12px', fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        {/* 消息滚动区 */}
        <div
          ref={chatScrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '11px 15px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background:
                    m.role === 'user'
                      ? 'linear-gradient(135deg, #4d7a55, #3c6443)'
                      : 'rgba(255, 255, 255, 0.88)',
                  color: m.role === 'user' ? '#ffffff' : 'var(--ink)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(210, 195, 175, 0.6)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {/* 实时流式响应中 */}
          {isStreaming && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '11px 15px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'rgba(255, 255, 255, 0.88)',
                  border: '1px solid rgba(210, 195, 175, 0.6)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{streamingContent || '正在推敲...'}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 14,
                    background: '#4a8d5c',
                    animation: 'blink 0.8s infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* 防内耗/收敛引导卡片（达到 3 轮以上时出现） */}
          {showConvergenceCard && (
            <div
              style={{
                marginTop: 8,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(240, 248, 240, 0.9)',
                border: '1px solid rgba(90, 150, 95, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15 }}>🌿</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2d6a3f' }}>
                  推敲已触及深处：捕捉到了令你释怀的想法吗？
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                反复内耗不如化为具体的行动或认知印记。你可以随时将探讨所得封存为年轮。
              </p>
              <button
                type="button"
                className="primary"
                onClick={handleCaptureInsight}
                style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12 }}
              >
                以此顿悟留年轮
              </button>
            </div>
          )}
        </div>

        {/* 底部输入栏 */}
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid rgba(200, 185, 165, 0.4)',
            background: 'rgba(255, 255, 255, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <VoiceInputButton onTranscript={handleVoiceTranscript} size="sm" />
            <input
              type="text"
              value={inputText}
              placeholder="写下一句回应或困惑..."
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 20,
                border: '1px solid rgba(180, 160, 130, 0.5)',
                background: 'rgba(255, 255, 255, 0.95)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="button"
              className="primary"
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
              style={{
                borderRadius: 20,
                padding: '8px 16px',
                fontSize: 13,
                minWidth: 54,
              }}
            >
              发送
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              按 Enter 发送 · 支持麦克风本地转写
            </span>
            <button
              type="button"
              className="ghost"
              onClick={handleCaptureInsight}
              style={{ fontSize: 11, padding: '3px 8px', color: '#3d6148' }}
            >
              留做年轮 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
