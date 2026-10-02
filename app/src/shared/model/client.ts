import type { DiscussInput, ListModelsResult, TestModelResult } from '../ipc'
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
  /** 由模型按用户的具体处境生成。生成不出来就留空——不塞通用话术。 */
  socraticQuestions?: Partial<Record<'guardian' | 'explorer' | 'outsider' | 'mirror', string>>
  /** 建议，不是处方。用户可以不采纳，也可以自己改写。 */
  microExperiment?: { action: string; observableCriterion: string; estimatedMinutes?: number }
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

/**
 * 取 /models 的地址。复用 chat 的归一化逻辑，只把结尾的 /chat/completions 换成 /models——
 * 这样 DeepSeek、OpenAI、智谱 v4、DashScope 兼容模式、Ollama、各类中转站都能落到对的位置。
 */
export function normalizeModelsUrl(baseUrl: string): string {
  return normalizeChatUrl(baseUrl).replace(/\/chat\/completions$/, '/models')
}

/**
 * 拉取服务端可用模型列表。
 * 兼容两种返回：OpenAI 系的 { data: [{ id }] }，以及 Ollama 原生的 { models: [{ name }] }。
 */
export async function listModels(cfg: ModelConfig): Promise<ListModelsResult> {
  // 不强制要求密钥：本地 Ollama 之类本来就没有密钥，让端点自己回答。
  const url = normalizeModelsUrl(cfg.baseUrl)
  const key = cfg.apiKey?.trim()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(url, {
      method: 'GET',
      headers: key ? { authorization: 'Bearer ' + key } : {},
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      let body = ''
      try {
        body = await res.text()
      } catch {}
      return {
        ok: false,
        models: [],
        error: 'HTTP ' + res.status + ': ' + res.statusText + (body ? ' - ' + body.slice(0, 160) : ''),
      }
    }
    const json = (await res.json()) as {
      data?: Array<{ id?: string }>
      models?: Array<{ id?: string; name?: string; model?: string }>
    }
    const fromData = (json.data ?? []).map((m) => m.id).filter((x): x is string => Boolean(x))
    const fromModels = (json.models ?? [])
      .map((m) => m.id ?? m.name ?? m.model)
      .filter((x): x is string => Boolean(x))
    const models = Array.from(new Set([...fromData, ...fromModels])).sort()
    if (models.length === 0) {
      return { ok: false, models: [], error: '端点返回成功，但没有解析到任何模型 id' }
    }
    return { ok: true, models }
  } catch (err) {
    const msg = (err as Error).name === 'AbortError' ? '请求超时 (15s)' : (err as Error).message || '网络连接失败'
    return { ok: false, models: [], error: msg }
  }
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
        '不要诊断原因，不要确认未经证实的他人意图，不要假装是现实里的人或咨询师。' +
        '【硬约束】不要给用户的情绪下判断或贴标签——不要说"你现在很焦虑""这属于委屈"这类归类。' +
        '可以承认感受（"被这样对待，确实可能让人难受"），但那是回应，不是分类。',
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
        '信息不足时就说信息不足，不要编造历史。' +
        '【硬约束】不要给用户的想法贴任何认知扭曲标签（如"灾难化""以偏概全"），不要诊断，不要说教。' +
        'socraticQuestions 与 microExperiment 必须针对这位用户这次说的具体内容来写；' +
        '写不出来就留空，绝不要填通用模板。microExperiment 是一个可撤回的小建议，不是处方。返回 JSON：' +
        '{"views":{"guardian":"","explorer":"","outsider":""},"quotedInput":[],"assumptions":[],"reframedQuestion":"",' +
        '"socraticQuestions":{"guardian":"","explorer":"","outsider":"","mirror":""},' +
        '"microExperiment":{"action":"","observableCriterion":"","estimatedMinutes":5}}',
    },
    { role: 'user', content: input },
  ]
}

function buildDiscussMessages(input: DiscussInput) {
  // 承接模式：只回应与澄清，**不提反问、不检验前提**。
  // 这正是它在定义上不构成认知挑战、因而不需要同意记录的原因。
  // ⚠️ 如果这里混进任何一个反问去检验前提，那道同意门槛就被绕过了——
  //    改动这一段时请连带检查 main/ipc.ts 里的门禁是否还成立。
  if ((input.mode ?? 'challenge') === 'receiving') {
    return [
      {
        role: 'system' as const,
        content:
          '你正在承接对方的表达，不是在和他一起检验想法。\n' +
          '【只做两件事】\n' +
          '1. 回应他刚说的话——承认感受，不评判、不劝解、不给建议。\n' +
          '2. 如果他的话有歧义、或你没听清，用一句话澄清（例如「你是说……吗？」）。\n' +
          '【硬约束】\n' +
          '· 不要提出任何反问去检验他的前提假设；不要出现「你有没有想过」「会不会其实」这类句式。\n' +
          '· 不要给他的情绪下判断或贴标签。可以说「被这样对待，确实可能让人难受」，但那是回应，不是分类。\n' +
          '· 不要诊断原因，不要确认未经证实的他人意图，不要假装是现实里的人或咨询师。\n' +
          '· 80~150 字，精炼克制。',
      },
      ...(input.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: input.userQuery },
    ]
  }

  const roleDescriptions: Record<string, string> = {
    guardian: '你正在以【守护者】的视角与用户深入探讨。你的使命是保护对方的心理能量与真实边界，识别疲惫与过度自我苛责，提供接纳感，同时反问对方「什么才是真正重要的底线与自我关照？」。',
    explorer: '你正在以【探索者】的视角与用户深入探讨。你的使命是激发好奇心，将看似死胡同的困境转化为探索实验的可能，反问对方「有没有一个极低成本、随时可撤回的小尝试？如果把这当成一个有趣的数据点呢？」。',
    outsider: '你正在以【局外人】的视角与用户深入探讨。你的使命是提供第三人称和长周期的时空纵深，拉开与当下情绪风暴的距离，反问对方「若站在一年后回看今天，这件事情真正留下的会是什么？其他在场的人可能会有怎样的局限与视角？」。',
    mirror: '你正在以【重构之镜】的视角与用户深入探讨。你的使命是温和地区分「已经发生的事」与「对它的解释」，让对方自己看见两者之间的空隙，反问对方「哪一部分是你亲眼所见，哪一部分是你补上去的？」。不要给对方的想法贴认知偏差的标签，也不要诊断。',
  }
  const desc = roleDescriptions[input.thread] || '你是一个富有同理心且具苏格拉底式反思智慧的陪伴者。'
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
