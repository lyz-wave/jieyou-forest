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

/** 单次录音的上限。再长下去转写会很慢，而且不像是一句话了。 */
const MAX_RECORD_MS = 60_000

export default function VoiceInputButton({
  onTranscript,
  disabled = false,
  className = '',
  size = 'md',
  title = '点击开始录音，再点一下结束并转写',
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [tip, setTip] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 桌面端与浏览器的语音走的是**两条完全不同的路**：
   *
   * · Electron：Web Speech API 永远不可用（它依赖 Chrome 内置的服务端识别引擎，
   *   Electron 构建没有那个密钥，官方 issue electron#46143，开发模式与打包版都一样）。
   *   所以走本机 whisper.cpp —— 顺带让"纯本地识别、不上传"这句话变成真的。
   * · 浏览器/移动端：Web Speech 是能用的，就用它。
   */
  const isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)

  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    // 桌面端不靠它，所以它有不算"支持"
    if (!isElectron && !SpeechRec) setSupported(false)
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
      if (autoStopRef.current) clearTimeout(autoStopRef.current)
    }
  }, [isElectron])

  const flashTip = useCallback((text: string, ms = 4000) => {
    setTip(text)
    setTimeout(() => setTip(''), ms)
  }, [])

  // ---------- 桌面端：录音 → 本机 whisper.cpp ----------
  const stopRecording = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    try {
      recorderRef.current?.stop()
    } catch {}
  }, [])

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      flashTip('这个环境拿不到麦克风接口。')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      flashTip('没有麦克风权限。到「系统设置 → 隐私与安全性 → 麦克风」里允许后重试。', 7000)
      return
    }

    const rec = new MediaRecorder(stream)
    chunksRef.current = []
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      setIsListening(false)
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
      chunksRef.current = []
      if (blob.size === 0) {
        flashTip('没有录到声音。')
        return
      }
      setTip('正在转写…')
      try {
        const audio = await blob.arrayBuffer()
        const r = await window.forest.transcribe({ audio, mimeType: blob.type })
        if (r.ok) {
          setTip('')
          onTranscript(r.text)
        } else {
          flashTip(r.error || '转写失败。', 7000)
        }
      } catch {
        flashTip('转写时出错了。', 6000)
      }
    }

    rec.start()
    recorderRef.current = rec
    setIsListening(true)
    setTip('正在听…再点一下结束')
    autoStopRef.current = setTimeout(stopRecording, MAX_RECORD_MS)
  }, [flashTip, onTranscript, stopRecording])

  // ---------- 浏览器/移动端：Web Speech ----------
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
      flashTip('当前运行环境不支持语音识别。')
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
          if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript
        }
        if (finalChunk.trim()) onTranscript(finalChunk.trim())
      }
      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') flashTip('请允许麦克风权限以使用语音输入')
        else if (event.error === 'no-speech') return
        else flashTip('识别提示: ' + event.error)
        setIsListening(false)
      }
      recognition.onend = () => setIsListening(false)

      recognitionRef.current = recognition
      recognition.start()
    } catch (err: any) {
      flashTip(err?.message || '语音输入启动失败')
      setIsListening(false)
    }
  }, [flashTip, onTranscript])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isListening) {
      if (isElectron) stopRecording()
      else stopListening()
      setTip('')
    } else if (isElectron) {
      void startRecording()
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
        disabled={disabled}
        aria-label={isListening ? '停止语音输入' : title}
        title={!supported ? '当前平台不支持语音识别' : isListening ? '点击结束并转写' : title}
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          border: isListening ? '1.5px solid #4a8d5c' : '1px solid rgba(180, 160, 130, 0.35)',
          background: isListening ? 'rgba(74, 141, 92, 0.18)' : 'rgba(255, 255, 255, 0.65)',
          color: isListening ? '#2d6a3f' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
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
