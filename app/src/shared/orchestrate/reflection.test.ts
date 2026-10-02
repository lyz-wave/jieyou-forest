import { describe, expect, it } from 'vitest'
import { quotedInputMatches, runReflection } from './reflection'
import type { ModelClient } from '../model/client'

const fakeModel = (over: Partial<ModelClient> = {}): ModelClient =>
  ({ available: true, receive: async function* () {}, reflect: async () => ({ views: { guardian: '', explorer: '', outsider: '' }, quotedInput: [], promptVersion: 't' }), ...over }) as ModelClient

describe('思考层', () => {
  it('没有同意记录就一律拒绝', async () => {
    const r = await runReflection({ model: fakeModel(), input: 'x', timeoutMs: 1000 })
    expect(r).toEqual({ ok: false, reason: 'no_consent' })
  })

  it('模型不可用时如实报未完成，不产出任何内容', async () => {
    const r = await runReflection({ model: fakeModel({ available: false }), input: 'x', consentAt: 'now', timeoutMs: 1000 })
    expect(r).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('引用无法逐字命中输入时整次丢弃', async () => {
    const model = fakeModel({
      reflect: async () => ({
        views: { guardian: 'g', explorer: 'e', outsider: 'o' },
        quotedInput: ['这句话用户根本没说过'],
        promptVersion: 't',
      }),
    })
    const r = await runReflection({ model, input: '今天开会被打断了三次', consentAt: 'now', timeoutMs: 1000 })
    expect(r).toEqual({ ok: false, reason: 'invalid' })
  })

  it('引用逐字命中时正常返回', async () => {
    const model = fakeModel({
      reflect: async () => ({
        views: { guardian: 'g', explorer: 'e', outsider: 'o' },
        quotedInput: ['开会被打断'],
        promptVersion: 't',
      }),
    })
    const r = await runReflection({ model, input: '今天开会被打断了三次', consentAt: 'now', timeoutMs: 1000 })
    expect(r.ok).toBe(true)
  })

  it('引用匹配是逐字的，近似不算', () => {
    expect(quotedInputMatches(['开会'], '今天开会了')).toBe(true)
    expect(quotedInputMatches(['开会的时候'], '今天开会了')).toBe(false)
    expect(quotedInputMatches([''], '今天开会了')).toBe(false)
  })
})
