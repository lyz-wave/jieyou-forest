import { randomUUID } from 'node:crypto'
import { capabilitiesFor, type GateResult } from '../../shared/gate/gate'
import type { Capabilities, SessionPath, SessionStatus } from '../../shared/types'

export interface LiveSession {
  id: string
  input: string
  mode?: SessionPath
  consentAt?: string
  status: SessionStatus
  gate: GateResult
  usedFallback: boolean
}

/**
 * 未保存的会话只活在这里，进程退出即消失。这是 ADR-0002 的技术落点：
 * 只有用户按下保存，才会往 SQLite 写第一行。
 */
export class SessionMemory {
  private live = new Map<string, LiveSession>()

  create(input: string, gate: GateResult): LiveSession {
    const s: LiveSession = {
      id: randomUUID(), input, gate, status: 'receiving', usedFallback: false,
    }
    this.live.set(s.id, s)
    return s
  }

  get(id: string): LiveSession | undefined {
    return this.live.get(id)
  }

  capabilities(id: string): Capabilities {
    const s = this.must(id)
    return capabilitiesFor(s.gate.level)
  }

  choosePath(id: string, path: SessionPath): LiveSession {
    const s = this.must(id)
    const caps = capabilitiesFor(s.gate.level)
    if (!caps.canRest) throw new Error('当前状态不提供休息路径')
    if (path === 'reflect' && !caps.canReflect) throw new Error('当前状态不提供思考路径')
    s.mode = path
    s.status = path === 'rest' ? 'resting' : 'reflecting'
    return s
  }

  /** 调用三视角的唯一合法入口。没有它，restricting 层永远不会被触发。 */
  grantConsent(id: string): LiveSession {
    const s = this.must(id)
    if (!capabilitiesFor(s.gate.level).canReflect) throw new Error('当前状态不提供思考路径')
    if (s.mode !== 'reflect') throw new Error('还没有选择思考路径')
    s.consentAt = new Date().toISOString()
    return s
  }

  cancelReflect(id: string): LiveSession {
    const s = this.must(id)
    s.mode = undefined
    s.status = 'choosing'
    return s
  }

  applyCorrection(id: string, gate: GateResult): LiveSession {
    const s = this.must(id)
    s.gate = gate
    if (s.mode === 'reflect') s.mode = undefined
    s.status = 'choosing'
    return s
  }

  end(id: string): LiveSession {
    const s = this.must(id)
    s.status = 'ended'
    return s
  }

  /** 用户没保存就离开：直接丢掉，什么都不写。 */
  drop(id: string): void {
    this.live.delete(id)
  }

  private must(id: string): LiveSession {
    const s = this.live.get(id)
    if (!s) throw new Error('会话不存在或已随内存消失')
    return s
  }
}

/** 架构文档 §1 的第一条不变量：没有 consentAt，就没有认知挑战。 */
export function canEnterReflection(s: LiveSession): boolean {
  return s.consentAt != null && capabilitiesFor(s.gate.level).canReflect
}
