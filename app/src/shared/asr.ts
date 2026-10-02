/**
 * 语音转文字的端点适配。
 *
 * 背景：渲染层的 Web Speech API（webkitSpeechRecognition）在 Electron 里
 * 是死的——Chromium 的语音识别要 Google 的在线服务密钥，Electron 不带；
 * iOS WKWebView 干脆没有这个接口。所以「点了麦克风没反应」不是按钮的
 * 样式问题，是那条链路根本不存在。
 *
 * 这里改走用户自己配置的 OpenAI 兼容端点：
 *   POST {baseUrl}/audio/transcriptions   (multipart/form-data)
 *   file=录音, model=识别模型
 * OpenAI 官方、硅基流动、以及 OneAPI / NewAPI 这类中转站都提供这条路由。
 *
 * 纯函数部分（URL 归一化、模型推断、文件名推断）单独拆出来，
 * 主进程与渲染层的移动端适配器共用同一份，行为不会漂移。
 */

export interface AsrEndpointConfig {
  baseUrl: string
  apiKey?: string
  /** 识别模型。留空则按端点推断（见 defaultAsrModel）。 */
  model?: string
}

export interface TranscribeOptions {
  audio: Uint8Array
  /** 录音的 MIME 类型，用来推断文件名后缀 */
  mimeType: string
  config: AsrEndpointConfig
  signal?: AbortSignal
}

/** 把聊天端点改写成转写端点。与 model/client.ts 的 normalizeChatUrl 同构。 */
export function normalizeTranscriptionUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '')
  if (!clean) return ''
  if (clean.endsWith('/audio/transcriptions')) return clean
  if (clean.endsWith('/chat/completions')) {
    return clean.slice(0, -'/chat/completions'.length) + '/audio/transcriptions'
  }
  if (/\/v\d+$/.test(clean) || clean.endsWith('/compatible-mode/v1')) {
    return clean + '/audio/transcriptions'
  }
  try {
    const parsed = new URL(clean)
    if (parsed.pathname === '' || parsed.pathname === '/') {
      return `${clean}/v1/audio/transcriptions`
    }
  } catch {}
  return `${clean}/audio/transcriptions`
}

/** 按端点推断识别模型。只对确定支持的那几家给专门值，其余走 OpenAI 通用名。 */
export function defaultAsrModel(baseUrl: string): string {
  let host = ''
  try {
    host = new URL(baseUrl.trim()).hostname.toLowerCase()
  } catch {
    host = baseUrl.trim().toLowerCase()
  }
  if (host.includes('siliconflow')) return 'FunAudioLLM/SenseVoiceSmall'
  return 'whisper-1'
}

/** 识别服务多半按后缀判容器格式，所以文件名不能瞎起。 */
export function guessAudioFilename(mimeType: string): string {
  const mime = (mimeType || '').toLowerCase()
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'audio.m4a'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'audio.mp3'
  if (mime.includes('wav')) return 'audio.wav'
  if (mime.includes('ogg')) return 'audio.ogg'
  return 'audio.webm'
}

/** 把 Uint8Array 拷进一块普通的 ArrayBuffer，避免把 SharedArrayBuffer 或
 *  带偏移的视图塞给 Blob（Node 与浏览器对这两种情况的处理并不一致）。 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(ab).set(bytes)
  return ab
}

/**
 * 调一次转写，成功返回文本。失败一律抛错，错误消息尽量原样带上服务端返回，
 * 因为「模型名不对」和「端点不支持这条路」只能靠服务端那句话分辨。
 */
export async function transcribeAudio(opts: TranscribeOptions): Promise<string> {
  const { config } = opts
  if (!config.apiKey?.trim()) {
    throw new Error('还没有填写 API Key，语音识别需要走你配置的端点')
  }
  const url = normalizeTranscriptionUrl(config.baseUrl)
  if (!url) {
    throw new Error('还没有填写 API 地址')
  }
  if (!opts.audio || opts.audio.byteLength === 0) {
    throw new Error('没有录到声音')
  }

  const form = new FormData()
  const filename = guessAudioFilename(opts.mimeType)
  form.append(
    'file',
    new Blob([toArrayBuffer(opts.audio)], { type: opts.mimeType || 'audio/webm' }),
    filename,
  )
  form.append('model', config.model?.trim() || defaultAsrModel(config.baseUrl))
  form.append('response_format', 'json')

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + config.apiKey.trim() },
      body: form,
      signal: opts.signal,
    })
  } catch (err: any) {
    // Node 的 fetch 只会抛一句 "fetch failed"，真正的原因在 cause 里。
    // 不拆开的话，用户看到「语音识别失败：fetch failed」完全无从下手。
    const cause = err?.cause
    const detail = cause?.code || cause?.message || err?.message || '网络不可达'
    throw new Error(`连不上识别端点 ${url}：${detail}`)
  }

  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {}
    throw new Error(`识别端点返回 ${res.status}${detail ? '：' + detail : ''}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = (await res.json()) as { text?: string }
    const text = (data?.text ?? '').trim()
    if (!text) throw new Error('识别端点没有返回文字')
    return text
  }
  // 少数中转站直接回纯文本
  const text = (await res.text()).trim()
  if (!text) throw new Error('识别端点没有返回文字')
  return text
}
