import { describe, expect, it } from 'vitest'
import { evaluateGate, type RulesFile } from '../gate/gate'
import rules from '../gate/rules.json'
import { canEnterReflection, SessionMemory } from './session'
import { countRings, countSessions } from '../store/repo'
import { openDatabase } from '../store/db'

const R = rules as RulesFile
const fresh = () => new SessionMemory()

describe('会话状态机', () => {
  it('没有同意记录时进不了思考路径', () => {
    const m = fresh()
    const s = m.create('今天有点累', evaluateGate({ text: '今天有点累' }, R))
    m.choosePath(s.id, 'reflect')
    expect(canEnterReflection(m.get(s.id)!)).toBe(false)
    m.grantConsent(s.id)
    expect(canEnterReflection(m.get(s.id)!)).toBe(true)
  })

  it('L2 会话可以休息，但选不了思考路径', () => {
    const m = fresh()
    const s = m.create('我快撑不下去了', evaluateGate({ text: '我快撑不下去了' }, R))
    expect(m.capabilities(s.id)).toMatchObject({ canRest: true, canReflect: false })
    expect(() => m.choosePath(s.id, 'reflect')).toThrow(/思考/)
    expect(m.choosePath(s.id, 'rest').status).toBe('resting')
  })

  it('L1 会话连休息卡都不出，只出危机支持', () => {
    const m = fresh()
    const s = m.create('我想自杀', evaluateGate({ text: '我想自杀' }, R))
    expect(m.capabilities(s.id).canShowCrisis).toBe(true)
    expect(() => m.choosePath(s.id, 'rest')).toThrow(/休息/)
  })

  it('用户更正之后能休息了，仍然不能思考', () => {
    const m = fresh()
    const text = '我不会自杀，我只是想找人说说话'
    const s = m.create(text, evaluateGate({ text }, R))
    expect(() => m.choosePath(s.id, 'rest')).not.toThrow()
    expect(() => m.choosePath(s.id, 'reflect')).toThrow()
  })

  it('走完一遍但没保存：数据库里一行都没有', () => {
    const db = openDatabase(':memory:')
    const m = fresh()
    const s = m.create('今天被拒了', evaluateGate({ text: '今天被拒了' }, R))
    m.choosePath(s.id, 'rest')
    m.end(s.id)
    expect(countSessions(db)).toBe(0)
    expect(countRings(db)).toBe(0)
  })
})
