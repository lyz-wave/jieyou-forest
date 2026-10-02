import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TranscribeResult } from '../../shared/ipc'

const run = promisify(execFile)

/**
 * 本地语音转写。
 *
 * 为什么不用 Web Speech API：它依赖 Chrome 内置的服务端识别引擎（需要专有密钥），
 * Electron 构建里没有，因此**在桌面版永远不可用**——官方 issue electron#46143，
 * 开发模式与打包版都一样，维护者认定为平台限制。他们给出的正解就是走本地 Whisper。
 *
 * 这条链路有一个额外的好处：音频从头到尾不离开这台电脑，所以"纯本地识别"这句话
 * 在这里是真的，而不是一句文案。
 *
 * 实测（4 秒中文音频）：
 *   Python 版 whisper        15.8 秒（每次都要重新加载模型）
 *   whisper.cpp + Metal      1.0 秒首次 / 0.29 秒后续
 * 所以走 whisper.cpp。
 */
const PROMPT = '请用简体中文转写这段话。'

/** 模型与工具的候选位置。可用环境变量覆盖，方便换更大的模型。 */
function findModel(): string | undefined {
  const candidates = [
    process.env.FOREST_WHISPER_MODEL,
    join(homedir(), '.cache', 'whisper.cpp', 'ggml-small.bin'),
    join(homedir(), '.cache', 'whisper.cpp', 'ggml-base.bin'),
    '/opt/homebrew/share/whisper.cpp/ggml-base.bin',
  ].filter((p): p is string => Boolean(p))
  return candidates.find((p) => existsSync(p))
}

function explain(err: unknown): string {
  const e = err as { code?: string; stderr?: string; killed?: boolean; signal?: string }
  if (e?.code === 'ENOENT') {
    return '本机没有找到 ffmpeg 或 whisper-cli。语音输入需要它们：brew install ffmpeg whisper-cpp'
  }
  if (e?.killed || e?.signal) return '转写超时了，录音太长或机器太忙。'
  const tail = (e?.stderr ?? '').trim().split('\n').slice(-1)[0]
  return tail ? '转写失败：' + tail : '转写失败。'
}

export async function transcribeLocal(audio: ArrayBuffer, _mimeType: string): Promise<TranscribeResult> {
  const model = findModel()
  if (!model) {
    return {
      ok: false,
      text: '',
      error: '没有找到本地语音模型。可运行：mkdir -p ~/.cache/whisper.cpp && curl -L -o ~/.cache/whisper.cpp/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    }
  }
  if (audio.byteLength === 0) return { ok: false, text: '', error: '没有录到声音。' }

  const dir = await mkdtemp(join(tmpdir(), 'jieyou-voice-'))
  const raw = join(dir, 'in.webm')
  const wav = join(dir, 'in.wav')
  const out = join(dir, 'out')
  try {
    await writeFile(raw, Buffer.from(audio))
    // whisper 只吃 16kHz 单声道 wav
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], {
      timeout: 60_000,
    })
    await run(
      'whisper-cli',
      ['-m', model, '-f', wav, '-l', 'zh', '-nt', '-otxt', '-of', out, '--prompt', PROMPT],
      { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    )
    const text = (await readFile(out + '.txt', 'utf8')).trim()
    if (!text) return { ok: false, text: '', error: '没有听清，能再说一遍吗？' }
    return { ok: true, text }
  } catch (err) {
    return { ok: false, text: '', error: explain(err) }
  } finally {
    // 录音是隐私数据，无论成败都从磁盘上抹掉
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
