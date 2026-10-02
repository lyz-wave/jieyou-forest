import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createModelClient, listModels, normalizeChatUrl, normalizeModelsUrl, testConnection } from './client'

/** 起一个本地假端点，用来端到端验证「获取模型列表」这条链路。 */
function stubServer(handler: (path: string) => { status: number; body: unknown }): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const { status, body } = handler(req.url ?? '')
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({
        url: 'http://127.0.0.1:' + port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      })
    })
  })
}

const open: Array<() => Promise<void>> = []
afterEach(async () => {
  while (open.length) await open.pop()!()
})

describe('大模型客户端与中转站配置适配', () => {
  it('URL 归一化：支持各类厂商与中转站格式', () => {
    // 域名无路径
    expect(normalizeChatUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(normalizeChatUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/chat/completions')
    // 带 /v1 后缀
    expect(normalizeChatUrl('https://api.deepseek.com/v1')).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(normalizeChatUrl('https://api.deepseek.com/v1/')).toBe('https://api.deepseek.com/v1/chat/completions')
    // 带 /v4 后缀（智谱）
    expect(normalizeChatUrl('https://open.bigmodel.cn/api/paas/v4')).toBe(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    )
    // 阿里百炼兼容模式
    expect(normalizeChatUrl('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    )
    // 已经包含 /chat/completions
    expect(normalizeChatUrl('https://my-proxy.com/v1/chat/completions')).toBe(
      'https://my-proxy.com/v1/chat/completions',
    )
    expect(normalizeChatUrl('https://my-proxy.com/chat/completions/')).toBe(
      'https://my-proxy.com/chat/completions',
    )
  })

  it('无 API Key 时快速校验拦截', async () => {
    const res = await testConnection({
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      receiveTimeoutMs: 1000,
      reflectTimeoutMs: 1000,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('请先填写 API Key')
  })

  it('未配置 Key 时客户端标记为不可用', () => {
    const client = createModelClient({
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      receiveTimeoutMs: 1000,
      reflectTimeoutMs: 1000,
    })
    expect(client.available).toBe(false)
  })

  it('配置 Key 时客户端标记为可用', () => {
    const client = createModelClient({
      apiKey: 'sk-test-123456',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      receiveTimeoutMs: 1000,
      reflectTimeoutMs: 1000,
    })
    expect(client.available).toBe(true)
  })

  it('取模型列表的地址：把 /chat/completions 换成 /models，其余照旧', () => {
    expect(normalizeModelsUrl('https://api.deepseek.com/v1')).toBe('https://api.deepseek.com/v1/models')
    expect(normalizeModelsUrl('https://api.deepseek.com/v1/chat/completions')).toBe('https://api.deepseek.com/v1/models')
    expect(normalizeModelsUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/models')
    expect(normalizeModelsUrl('https://open.bigmodel.cn/api/paas/v4')).toBe('https://open.bigmodel.cn/api/paas/v4/models')
    expect(normalizeModelsUrl('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    )
    // 本地 Ollama：没有 /v1 也要能落到兼容端点上
    expect(normalizeModelsUrl('http://localhost:11434')).toBe('http://localhost:11434/v1/models')
    // 实测可用的两家厂商（/models 均返回 200）：
    // Command Code 的路径里有一段 /provider，仍然靠"以 /vN 结尾"命中
    expect(normalizeModelsUrl('https://api.commandcode.ai/provider/v1')).toBe(
      'https://api.commandcode.ai/provider/v1/models',
    )
    expect(normalizeChatUrl('https://api.commandcode.ai/provider/v1')).toBe(
      'https://api.commandcode.ai/provider/v1/chat/completions',
    )
    // OpenCode Zen 是多段路径 + /v1 结尾
    expect(normalizeModelsUrl('https://opencode.ai/zen/v1')).toBe('https://opencode.ai/zen/v1/models')
    expect(normalizeChatUrl('https://opencode.ai/zen/v1')).toBe('https://opencode.ai/zen/v1/chat/completions')
  })

  it('OpenAI 风格的 { data: [{ id }] } 能解析出来', async () => {
    const s = await stubServer(() => ({ status: 200, body: { data: [{ id: 'deepseek-reasoner' }, { id: 'deepseek-chat' }] } }))
    open.push(s.close)
    const res = await listModels({ baseUrl: s.url, model: 'x', receiveTimeoutMs: 5000, reflectTimeoutMs: 5000 })
    expect(res.ok).toBe(true)
    expect(res.models).toEqual(['deepseek-chat', 'deepseek-reasoner'])
  })

  it('Ollama 原生风格的 { models: [{ name }] } 也能解析', async () => {
    const s = await stubServer(() => ({ status: 200, body: { models: [{ name: 'llama3:8b' }, { model: 'qwen2.5' }] } }))
    open.push(s.close)
    const res = await listModels({ baseUrl: s.url, model: 'x', receiveTimeoutMs: 5000, reflectTimeoutMs: 5000 })
    expect(res.ok).toBe(true)
    expect(res.models).toEqual(['llama3:8b', 'qwen2.5'])
  })

  it('命中 /models 路径而不是 /chat/completions', async () => {
    const seen: string[] = []
    const s = await stubServer((path) => {
      seen.push(path)
      return { status: 200, body: { data: [{ id: 'm' }] } }
    })
    open.push(s.close)
    await listModels({ baseUrl: s.url, model: 'x', receiveTimeoutMs: 5000, reflectTimeoutMs: 5000 })
    expect(seen).toEqual(['/v1/models'])
  })

  it('401 时如实报错，不假装成功', async () => {
    const s = await stubServer(() => ({ status: 401, body: { error: 'invalid api key' } }))
    open.push(s.close)
    const res = await listModels({ baseUrl: s.url, model: 'x', receiveTimeoutMs: 5000, reflectTimeoutMs: 5000 })
    expect(res.ok).toBe(false)
    expect(res.models).toEqual([])
    expect(res.error).toContain('401')
  })

  it('返回成功但解析不出模型时，如实说明而不是给一个空列表当成功', async () => {
    const s = await stubServer(() => ({ status: 200, body: { object: 'list' } }))
    open.push(s.close)
    const res = await listModels({ baseUrl: s.url, model: 'x', receiveTimeoutMs: 5000, reflectTimeoutMs: 5000 })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('没有解析到')
  })

  it('不带密钥也能取列表（本地 Ollama 场景），且不会发出空的 Bearer', async () => {
    let auth: string | undefined = 'unset'
    const server: Server = createServer((req, res) => {
      auth = req.headers.authorization as string | undefined
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [{ id: 'local-model' }] }))
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    open.push(() => new Promise<void>((done) => server.close(() => done())))

    const res = await listModels({ baseUrl: 'http://127.0.0.1:' + port, model: 'x', receiveTimeoutMs: 5000, reflectTimeoutMs: 5000 })
    expect(res.ok).toBe(true)
    expect(res.models).toEqual(['local-model'])
    expect(auth).toBeUndefined()
  })
})
