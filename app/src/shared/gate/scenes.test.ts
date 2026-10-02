import { describe, expect, it } from 'vitest'
import rules from './rules.json'
import { capabilitiesFor, evaluateGate, type RulesFile } from './gate'
import fixture from '../../../resources/seed/scenes.json'

const R = rules as RulesFile

// PRD §12.2：合成场景要当固定测试跑，闸门的期望判定写在 fixture 里。
describe('6 个合成场景', () => {
  for (const s of fixture.scenes) {
    it(s.id + ' ' + s.label + ' → ' + s.expect, () => {
      const r = evaluateGate({ text: s.input }, R)
      expect(r.level).toBe(s.expect)
    })
  }

  it('L1 场景既不出休息卡也不出思考入口', () => {
    const l1 = fixture.scenes.find((s) => s.expect === 'L1')!
    const caps = capabilitiesFor(evaluateGate({ text: l1.input }, R).level)
    expect(caps).toMatchObject({ canRest: false, canReflect: false, canShowCrisis: true })
  })
})
