import type { ModelClient } from '../model/client'
import { fallbackReceive } from '../fallback/seed'

export interface ReceiveOutcome {
  text: string
  isFallback: boolean
  banner?: string
  errorCode?: string
}

/**
 * 承接层。它允许兜底，但兜底必须带标识（架构文档 §5 失败矩阵第一段）。
 * 45 秒拿不到东西就切示例稿，不重试第二次——用户还等着。
 */
export async function runReceive(deps: {
  model: ModelClient
  input: string
  emit: (delta: string, done: boolean) => void
  timeoutMs: number
}): Promise<ReceiveOutcome> {
  if (!deps.model.available) {
    const f = fallbackReceive()
    deps.emit(f.text, true)
    return { text: f.text, isFallback: true, banner: f.banner, errorCode: 'model_unavailable' }
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), deps.timeoutMs)
  let text = ''
  try {
    for await (const delta of deps.model.receive(deps.input, ac.signal)) {
      text += delta
      deps.emit(delta, false)
    }
    clearTimeout(timer)
    if (!text.trim()) throw new Error('模型返回空内容')
    deps.emit('', true)
    return { text, isFallback: false }
  } catch (e) {
    clearTimeout(timer)
    const f = fallbackReceive()
    deps.emit(f.text, true)
    return {
      text: f.text,
      isFallback: true,
      banner: f.banner,
      errorCode: ac.signal.aborted ? 'timeout' : 'generation_failed',
    }
  }
}
