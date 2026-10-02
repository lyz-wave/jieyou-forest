import type { ThreeViews } from '../orchestrate/reflection'

export interface ModelConfig {
  apiKey?: string
  baseUrl: string
  model: string
  /** 承接回应 45 秒、三视角 30 秒（架构文档 §5） */
  receiveTimeoutMs: number
  reflectTimeoutMs: number
}

export interface ReflectionResult {
  views: ThreeViews
  quotedInput: string[]
  assumptions?: string[]
  reframedQuestion?: string
  promptVersion: string
}

/** 模型是可选出站：没有 key 时整体禁用，承接层走内置示例稿，思考层如实报未完成。 */
export interface ModelClient {
  readonly available: boolean
  receive(input: string, signal: AbortSignal): AsyncGenerator<string>
  reflect(input: string, signal: AbortSignal): Promise<ReflectionResult>
}

export function loadConfig(env = process.env): ModelConfig {
  return {
    apiKey: env.FOREST_API_KEY ?? env.DEEPSEEK_API_KEY,
    baseUrl: env.FOREST_BASE_URL ?? 'https://api.deepseek.com/v1',
    model: env.FOREST_MODEL ?? 'deepseek-chat',
    receiveTimeoutMs: 45_000,
    reflectTimeoutMs: 30_000,
  }
}

export const PROMPT_VERSION = 'receive-1 | reflect-3views-1'

export function createModelClient(cfg: ModelConfig): ModelClient {
  const available = Boolean(cfg.apiKey)
  if (!available) {
    return {
      available: false,
      // eslint-disable-next-line require-yield
      async *receive() {
        throw new Error('模型未配置')
      },
      async reflect() {
        throw new Error('模型未配置')
      },
    }
  }

  const chat = async (body: unknown, signal: AbortSignal): Promise<Response> => {
    const res = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({ model: cfg.model, ...(body as object) }),
      signal,
    })
    if (!res.ok) throw new Error('模型返回 ' + res.status)
    return res
  }

  return {
    available: true,

    async *receive(input, signal) {
      const res = await chat({ stream: true, messages: receiveMessages(input) }, signal)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') return
          try {
            const delta = JSON.parse(payload).choices?.[0]?.delta?.content
            if (delta) yield delta as string
          } catch {
            // 半个 JSON，丢掉这一块继续读
          }
        }
      }
    },

    async reflect(input, signal) {
      const res = await chat(
        {
          stream: false,
          response_format: { type: 'json_object' },
          messages: reflectMessages(input),
        },
        signal,
      )
      const json = (await res.json()) as { choices: Array<{ message: { content: string } }> }
      const parsed = JSON.parse(json.choices[0].message.content) as Omit<ReflectionResult, 'promptVersion'>
      return { ...parsed, promptVersion: PROMPT_VERSION }
    },
  }
}

function receiveMessages(input: string) {
  return [
    {
      role: 'system',
      content:
        '你在承接一个人的情绪。用 50–100 字承认对方的感受，给出「先歇一会儿」和「陪我想一想」两个自主选择。' +
        '不要诊断原因，不要确认未经证实的他人意图，不要假装是现实里的人或咨询师。',
    },
    { role: 'user', content: input },
  ]
}

function reflectMessages(input: string) {
  return [
    {
      role: 'system',
      content:
        '用户已明确同意检查自己的想法。一次输出三个视角（守护者/探索者/局外人）与一面折返镜。' +
        '三视角不是三个独立智能体，是你一次思考的三个角度。所有引用用户原话的片段必须逐字来自用户输入。' +
        '信息不足时就说信息不足，不要编造历史。返回 JSON：' +
        '{"views":{"guardian":"","explorer":"","outsider":""},"quotedInput":[],"assumptions":[],"reframedQuestion":""}',
    },
    { role: 'user', content: input },
  ]
}
