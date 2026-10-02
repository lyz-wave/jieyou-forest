import { useState, useRef, useEffect, useCallback } from 'react'

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
  title?: string
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

export default function VoiceInputButton({
  onTranscript,
  disabled = false,
  className = '',
  size = 'md',
  // 文案必须是实话：Web Speech API 会把音频交给系统/浏览器的识别服务（通常联网）。
  // 原来写的是"本地识别不上传"，那是不实的。
  title = '语音输入（由系统识别服务转写，会联网）',
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [tip, setTip] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      setSupported(false)
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      setTip('当前运行环境不支持语音识别（Electron 打包版通常不可用）')
      setTimeout(() => setTip(''), 3000)
      return
    }

    try {
      const recognition: SpeechRecognitionInstance = new SpeechRec()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'zh-CN'

      recognition.onstart = () => {
        setIsListening(true)
        setTip('正在聆听中，说完了可再点一下停止...')
      }

      recognition.onresult = (event: any) => {
        let finalChunk = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript
          }
        }
        if (finalChunk.trim()) {
          onTranscript(finalChunk.trim())
        }
      }

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
        if (event.error === 'not-allowed') {
          setTip('请允许麦克风权限以使用语音输入')
        } else if (event.error === 'no-speech') {
          // 暂时无声，不中断
          return
        } else {
          setTip(`识别提示: ${event.error}`)
        }
        setTimeout(() => setTip(''), 4000)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err: any) {
      setTip(err.message || '语音输入启动失败')
      setTimeout(() => setTip(''), 3000)
      setIsListening(false)
    }
  }, [onTranscript])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isListening) {
      stopListening()
      setTip('')
    } else {
      startListening()
    }
  }

  const btnSize = size === 'sm' ? 32 : 38
  const iconSize = size === 'sm' ? 16 : 20

  return (
    <div className={`voice-input-wrapper ${className}`} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || !supported}
        aria-label={isListening ? '停止语音输入' : title}
        title={!supported ? '当前平台不支持语音识别' : isListening ? '点击停止语音输入' : title}
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          border: isListening ? '1.5px solid #4a8d5c' : '1px solid rgba(180, 160, 130, 0.35)',
          background: isListening
            ? 'rgba(74, 141, 92, 0.18)'
            : 'rgba(255, 255, 255, 0.65)',
          color: isListening ? '#2d6a3f' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled || !supported ? 'not-allowed' : 'pointer',
          padding: 0,
          transition: 'all 0.2s cubic-bezier(0.2, 1, 0.3, 1)',
          boxShadow: isListening
            ? '0 0 0 4px rgba(74, 141, 92, 0.25), 0 2px 8px rgba(40, 100, 60, 0.2)'
            : '0 1px 4px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {isListening ? (
          <span className="voice-wave-anim" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span className="wave-bar b1" />
            <span className="wave-bar b2" />
            <span className="wave-bar b3" />
          </span>
        ) : (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {tip && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 36, 32, 0.92)',
            color: '#fff',
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {tip}
        </div>
      )}
    </div>
  )
}
