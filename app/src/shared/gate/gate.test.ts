import { describe, expect, it } from 'vitest'
import rules from './rules.json'
import { applyCorrection, capabilitiesFor, evaluateGate, type RulesFile } from './gate'

const R = rules as RulesFile

describe('安全闸门', () => {
  it('关键词命中即 L1，不依赖模型是否存在', () => {
    const r = evaluateGate({ text: '我不想活了，已经想好怎么结束生命' }, R)
    expect(r.level).toBe('L1')
    expect(r.reasonCode).toBe('l1_hit')
  })

  it('否定或转述语境把 L1 降到 L2，而不是降到 L3', () => {
    const r = evaluateGate({ text: '我不会自杀的，我只是想找人说说话' }, R)
    expect(r.level).toBe('L2')
    expect(r.reasonCode).toBe('context_excluded')
  })

  it('模型只能把 L3 抬到 L2，不能自己产出 L1', () => {
    const clean = '今天开会时被打断了三次，有点沮丧'
    expect(evaluateGate({ text: clean }, R).level).toBe('L3')
    expect(evaluateGate({ text: clean, modelVerdict: 'L2' }, R).level).toBe('L2')
  })

  it('模型无法把 L1 降级', () => {
    const r = evaluateGate({ text: '我想自杀', modelVerdict: 'L2' }, R)
    expect(r.level).toBe('L1')
  })

  it('L1 时不出休息卡也不出思考入口', () => {
    const c = capabilitiesFor('L1')
    expect(c).toMatchObject({ canRest: false, canReflect: false, canShowCrisis: true })
  })

  it('更正只降一级，且永远不解锁思考', () => {
    const l1 = evaluateGate({ text: '我想自杀' }, R)
    const fixed = applyCorrection(l1)
    expect(fixed.level).toBe('L2')
    expect(fixed.corrected).toBe(true)
    expect(capabilitiesFor(fixed.level)).toMatchObject({ canRest: true, canReflect: false })
  })

  it('更正不会把一个 L3 变成别的级别', () => {
    const l3 = evaluateGate({ text: '今天天气不错' }, R)
    expect(applyCorrection(l3).level).toBe('L3')
  })
})
