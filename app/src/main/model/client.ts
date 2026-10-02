import type { DiscussInput, TestModelResult } from '../../shared/ipc'
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

export interface ModelClient {
  readonly available: boolean
  receive(input: string, signal: AbortSignal): AsyncGenerator<string>
  reflect(input: string, signal: AbortSignal): Promise<ReflectionResult>
  discuss(input: DiscussInput, signal: AbortSignal): AsyncGenerator<string>
}

export function normalizeChatUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '')
  if (clean.endsWith('/chat/completions')) {
    return clean
  }
  if (/\/v\d+$/.test(clean) || clean.endsWith('/compatible-mode/v1')) {
    return clean + '/chat/completions'
  }
  try {
    const parsed = new URL(clean)
    if (parsed.pathname === '' || parsed.pathname === '/') {
      return `${clean}/v1/chat/completions`
    }
  } catch {}
  return `${clean}/chat/completions`
}

export async function testConnection(cfg: ModelConfig): Promise<TestModelResult> {
  if (!cfg.apiKey?.trim()) {
    return { ok: false, error: '请先填写 API Key' }
  }
  const url = normalizeChatUrl(cfg.baseUrl)
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: cfg.model.trim() || 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
        stream: false,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const latencyMs = Date.now() - start
    if (!res.ok) {
      let errBody = ''
      try {
        errBody = await res.text()
      } catch {}
      return {
        ok: false,
        latencyMs,
        error: `HTTP ${res.status}: ${res.statusText}${errBody ? ' - ' + errBody.slice(0, 160) : ''}`,
      }
    }
    return {
      ok: true,
      latencyMs,
      message: `连接成功，延迟 ${latencyMs}ms`,
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start
    const msg = err.name === 'AbortError' ? '请求超时 (15s)' : (err.message || '网络连接失败')
    return {
      ok: false,
      latencyMs,
      error: msg,
    }
  }
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
  const available = Boolean(cfg.apiKey?.trim())
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
      // eslint-disable-next-line require-yield
      async *discuss() {
        throw new Error('模型未配置')
      },
    }
  }

  const chat = async (body: unknown, signal: AbortSignal): Promise<Response> => {
    const url = normalizeChatUrl(cfg.baseUrl)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + cfg.apiKey?.trim(),
      },
      body: JSON.stringify({ model: cfg.model.trim() || 'deepseek-chat', ...(body as object) }),
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
      let res: Response
      try {
        res = await chat(
          {
            stream: false,
            response_format: { type: 'json_object' },
            messages: reflectMessages(input),
          },
          signal,
        )
      } catch (err: any) {
        // 如果 400，降级去除 response_format 尝试
        if (err.message && err.message.includes('400')) {
          res = await chat(
            {
              stream: false,
              messages: reflectMessages(input),
            },
            signal,
          )
        } else {
          throw err
        }
      }
      const json = (await res.json()) as { choices: Array<{ message: { content: string } }> }
      const rawContent = json.choices?.[0]?.message?.content ?? ''
      const parsed = extractJson(rawContent) as Omit<ReflectionResult, 'promptVersion'>
      return { ...parsed, promptVersion: PROMPT_VERSION }
    },

    async *discuss(input, signal) {
      const messages = buildDiscussMessages(input)
      const res = await chat({ stream: true, messages }, signal)
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
            // 忽略非完整 JSON 行
          }
        }
      }
    },
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const match = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed)
  const candidate = match ? match[1] : trimmed
  try {
    return JSON.parse(candidate)
  } catch {}
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(candidate.slice(start, end + 1))
  }
  throw new Error('无法从模型返回中提取有效 JSON: ' + text.slice(0, 100))
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

function buildDiscussMessages(input: DiscussInput) {
  const roleDescriptions: Record<string, string> = {
    guardian: '你正在以【守护者】的视角与用户深入探讨。你的使命是保护对方的心理能量与真实边界，识别疲惫与过度自我苛责，提供接纳感，同时反问对方「什么才是真正重要的底线与自我关照？」。',
    explorer: '你正在以【探索者】的视角与用户深入探讨。你的使命是激发好奇心，将看似死胡同的困境转化为探索实验的可能，反问对方「有没有一个极低成本、随时可撤回的小尝试？如果把这当成一个有趣的数据点呢？」。',
    outsider: '你正在以【局外人】的视角与用户深入探讨。你的使命是提供第三人称和长周期的时空纵深，拉开与当下情绪风暴的距离，反问对方「若站在一年后回看今天，这件事情真正留下的会是什么？其他在场的人可能会有怎样的局限与视角？」。',
    mirror: '你正在以【重构之镜】的视角与用户深入探讨。你的使命是温和映照出思维中的全或无、绝对化或读心术等认知偏差，反问对方「事实与脑补的边界在哪里？」。',
  }
  const desc = roleDescriptions[input.perspective] || '你是一个富有同理心且具苏格拉底式反思智慧的陪伴者。'
  const systemPrompt =
    `${desc}\n` +
    '【沟通准则】\n' +
    '1. 回复精炼克制，控制在 80~150 字以内，切勿长篇大论或居高临下说教。\n' +
    '2. 必须且仅提出 1 个启发性的苏格拉底式反问，引导对方挖掘自己的内在智慧与行动线索。\n' +
    '3. 防反刍：切勿顺着对方无休止纠结已成定局的痛苦细节，而是引导聚焦于「当下可掌控的小事」或「重新审视前提假设」。'

  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]
  if (input.history && input.history.length > 0) {
    for (const m of input.history) {
      msgs.push({ role: m.role, content: m.content })
    }
  }
  msgs.push({ role: 'user', content: input.userQuery })
  return msgs
}
