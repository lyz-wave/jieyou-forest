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

type Mode = 'idle' | 'asking' | 'recording' | 'transcribing'

/** 单次录音上限。语音识别按秒计费，也没有理由让一次录音无限长。 */
const MAX_RECORD_MS = 60_000

/** 挑一个浏览器与识别服务都认的容器格式。Chromium 出 webm/opus，
 *  Safari 与 WKWebView 只出 mp4。 */
function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime
    } catch {}
  }
  return ''
}

function speechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/**
 * 语音输入按钮。
 *
 * 两条链路，按可用性降级：
 *   1. window.forest.transcribe —— 录音后交主进程走用户配置的识别端点。
 *      这是 Electron（macOS 桌面版）与移动端适配器都走的路。
 *   2. Web Speech API —— 仅当宿主真的提供它时才用（Safari / 部分 Chromium）。
 *      Electron 不带 Google 语音服务密钥，webkitSpeechRecognition 看着存在
 *      但一调就报 network，所以只要有第 1 条就不碰它。
 * 两条都没有时按钮置灰并说明原因，而不是假装能点。
 */
export default function VoiceInputButton({
  onTranscript,
  disabled = false,
  className = '',
  size = 'md',
  // 文案必须是实话：主链路（window.forest.transcribe）把录音发往用户自己配置的
  // 识别端点；只有退回 Web Speech 时才会交给系统/浏览器的识别服务（通常联网）。
  title = '语音输入（录音发往你自己配置的识别端点；退回系统识别时会联网）',
}: VoiceInputButtonProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [tip, setTip] = useState('')
  const [hasEndpointAsr, setHasEndpointAsr] = useState(false)
  const [hasWebSpeech, setHasWebSpeech] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const autoStopRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const tipTimerRef = useRef<number | null>(null)

  const flashTip = useCallback((text: string, ms = 4000) => {
    setTip(text)
    if (tipTimerRef.current) window.clearTimeout(tipTimerRef.current)
    tipTimerRef.current = window.setTimeout(() => setTip(''), ms)
  }, [])

  useEffect(() => {
    const canRecord =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    setHasEndpointAsr(Boolean(window.forest?.transcribe) && canRecord)
    setHasWebSpeech(Boolean(speechRecognitionCtor()))
  }, [])

  const supported = hasEndpointAsr || hasWebSpeech

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current)
      if (tipTimerRef.current) window.clearTimeout(tipTimerRef.current)
      try {
        recognitionRef.current?.abort()
      } catch {}
      try {
        recorderRef.current?.stop()
      } catch {}
      releaseStream()
    }
  }, [releaseStream])

  /* ---------- 链路 1：录音 + 端点转写 ---------- */

  const stopRecording = useCallback(() => {
    if (autoStopRef.current) {
      window.clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    try {
      recorderRef.current?.stop()
    } catch {}
  }, [])

  const startRecording = useCallback(async () => {
    setMode('asking')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err: any) {
      setMode('idle')
      const name = err?.name || ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        flashTip('请在系统设置里允许解忧森林使用麦克风', 6000)
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        flashTip('没有找到可用的麦克风', 5000)
      } else {
        flashTip('麦克风打开失败：' + (err?.message || name || '未知原因'), 5000)
      }
      return
    }

    streamRef.current = stream
    chunksRef.current = []
    const mime = pickRecorderMime()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch (err: any) {
      releaseStream()
      setMode('idle')
      flashTip('这台设备不支持录音：' + (err?.message || 'MediaRecorder 不可用'), 5000)
      return
    }
    recorderRef.current = recorder

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onerror = () => {
      releaseStream()
      setMode('idle')
      flashTip('录音中断了，再试一次', 4000)
    }

    recorder.onstop = async () => {
      releaseStream()
      const type = recorder.mimeType || mime || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      if (blob.size === 0) {
        setMode('idle')
        flashTip('没有录到声音，再试一次', 4000)
        return
      }
      setMode('transcribing')
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const res = await window.forest.transcribe({ audio: bytes, mimeType: type })
        if (res.ok && res.text) {
          onTranscript(res.text)
          setMode('idle')
          setTip('')
        } else {
          setMode('idle')
          flashTip(res.error || '语音识别失败', 6000)
        }
      } catch (err: any) {
        setMode('idle')
        flashTip('语音识别失败：' + (err?.message || '未知原因'), 6000)
      }
    }

    recorder.start()
    setMode('recording')
    setTip('正在聆听中，说完了可再点一下停止...')
    autoStopRef.current = window.setTimeout(() => {
      flashTip('单次录音最多 60 秒，先按这里识别')
      stopRecording()
    }, MAX_RECORD_MS)
  }, [flashTip, onTranscript, releaseStream, stopRecording])

  /* ---------- 链路 2：Web Speech（宿主自带识别时才用） ---------- */

  const startWebSpeech = useCallback(() => {
    const Ctor = speechRecognitionCtor()
    if (!Ctor) {
      flashTip('当前运行环境不支持语音识别（Electron 打包版通常不可用）')
      return
    }
    try {
      const recognition = new Ctor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'zh-CN'

      recognition.onstart = () => {
        setMode('recording')
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
        if (event.error === 'no-speech') return
        if (event.error === 'not-allowed') flashTip('请允许麦克风权限以使用语音输入', 6000)
        else flashTip('识别提示：' + event.error, 5000)
        setMode('idle')
      }

      recognition.onend = () => setMode('idle')

      recognitionRef.current = recognition
      recognition.start()
    } catch (err: any) {
      setMode('idle')
      flashTip(err?.message || '语音输入启动失败', 4000)
    }
  }, [flashTip, onTranscript])

  /* ---------- 交互 ---------- */

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || !supported) return

    if (mode === 'recording') {
      if (hasEndpointAsr) stopRecording()
      else {
        try {
          recognitionRef.current?.stop()
        } catch {}
        setMode('idle')
      }
      setTip('')
      return
    }
    if (mode === 'asking' || mode === 'transcribing') return

    if (hasEndpointAsr) void startRecording()
    else startWebSpeech()
  }

  const busy = mode === 'asking' || mode === 'recording' || mode === 'transcribing'
  const active = mode === 'recording'
  const btnSize = size === 'sm' ? 32 : 38
  const iconSize = size === 'sm' ? 16 : 20

  const disabledReason = !supported
    ? '当前运行环境没有可用的语音识别通道'
    : disabled
      ? title
      : ''

  const stateLabel = mode === 'asking'
    ? '正在请求麦克风权限'
    : mode === 'recording'
      ? '正在聆听中，点击停止'
      : mode === 'transcribing'
        ? '正在识别'
        : title

  return (
    <div className={`voice-input-wrapper ${className}`} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || !supported}
        aria-label={active ? '停止语音输入' : title}
        aria-busy={busy}
        title={disabledReason || stateLabel}
        className={`voice-btn ${active ? 'listening' : ''} ${busy ? 'busy' : ''}`}
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          border: active ? '1.5px solid #4a8d5c' : '1px solid rgba(180, 160, 130, 0.35)',
          background: active
            ? 'rgba(74, 141, 92, 0.18)'
            : 'rgba(255, 255, 255, 0.65)',
          color: active ? '#2d6a3f' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled || !supported ? 'not-allowed' : 'pointer',
          opacity: disabled || !supported ? 0.55 : 1,
          padding: 0,
          transition: 'all 0.2s cubic-bezier(0.2, 1, 0.3, 1)',
          boxShadow: active
            ? '0 0 0 4px rgba(74, 141, 92, 0.25), 0 2px 8px rgba(40, 100, 60, 0.2)'
            : '0 1px 4px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {busy ? (
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
