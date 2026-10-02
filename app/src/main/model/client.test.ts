import { describe, expect, it } from 'vitest'
import { createModelClient, normalizeChatUrl, testConnection } from './client'

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
})
