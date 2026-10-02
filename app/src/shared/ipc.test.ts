import { describe, expect, it } from 'vitest'
import { CH } from './ipc'

const invokeNames: string[] = Object.values(CH.invoke)
const sendNames: string[] = Object.values(CH.send)
const all = [...invokeNames, ...sendNames]

describe('IPC 契约', () => {
  it('通道名不重复', () => {
    expect(new Set(all).size).toBe(all.length)
  })

  it('invoke 与 send 不共用通道名', () => {
    const invokeSet = new Set(invokeNames)
    expect(sendNames.filter((c) => invokeSet.has(c))).toEqual([])
  })

  it('通道名一律是 domain:action 形状', () => {
    for (const c of all) expect(c).toMatch(/^[a-z]+:[a-zA-Z]+$/)
  })
})
