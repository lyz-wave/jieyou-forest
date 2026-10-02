import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from './db'
import {
  assertRingDraft, clearAll, countRings, countSessions, deleteRing, getRing,
  isDatabaseEmpty, listRings, recordEvent, saveRing, saveSession,
} from './repo'

let db: Database.Database
beforeEach(() => {
  db = openDatabase(':memory:')
  saveSession(db, { id: 's1', input: '今天被拒了', mode: 'rest', status: 'ended' })
})

describe('存储层', () => {
  it('幂等：同一个 idempotencyKey 连点两次只产生一圈年轮', () => {
    const draft = { type: 'support' as const, userNote: '原来我只是累了', saveOriginal: false }
    const a = saveRing(db, 's1', draft, 'k-1')
    const b = saveRing(db, 's1', draft, 'k-1')
    expect(a).toBe(b)
    expect(countRings(db)).toBe(1)
  })

  it('陪伴年轮不强制行动与复盘', () => {
    expect(() => saveRing(db, 's1', { type: 'support', userNote: '先放这儿', saveOriginal: false }, 'k-2')).not.toThrow()
  })

  it('行动年轮缺行动 / 判据 / 未来复盘日都会被拦下', () => {
    expect(() => assertRingDraft({ type: 'action', userNote: '试一下', saveOriginal: false, criterion: 'c', reviewDue: '2099-01-01' })).toThrow(/行动/)
    expect(() => assertRingDraft({ type: 'action', userNote: '试一下', saveOriginal: false, action: 'a', reviewDue: '2099-01-01' })).toThrow(/判据/)
    expect(() => assertRingDraft({ type: 'action', userNote: '试一下', saveOriginal: false, action: 'a', criterion: 'c' })).toThrow(/复盘日期/)
    expect(() => assertRingDraft({ type: 'action', userNote: '试一下', saveOriginal: false, action: 'a', criterion: 'c', reviewDue: '2000-01-01' })).toThrow(/未来/)
  })

  it('不打开保存原文时不写正文', () => {
    const id = saveRing(db, 's1', { type: 'support', userNote: '一句观察', saveOriginal: false, originalText: '我写了很长一段' }, 'k-3')
    expect(getRing(db, id)?.original_text).toBeNull()
  })

  it('删除后列表与详情都读不到', () => {
    const id = saveRing(db, 's1', { type: 'support', userNote: 'x', saveOriginal: false }, 'k-4')
    expect(deleteRing(db, id)).toBe(true)
    expect(getRing(db, id)).toBeUndefined()
    expect(listRings(db)).toHaveLength(0)
  })

  it('清空之后数据库确实为空', () => {
    saveRing(db, 's1', { type: 'support', userNote: 'x', saveOriginal: false }, 'k-5')
    recordEvent(db, { anonymousSessionId: 'a1', eventName: 'ring_saved', resultCode: 'ok' })
    clearAll(db)
    expect(isDatabaseEmpty(db)).toBe(true)
  })

  it('未保存时 session 表就是空的 —— 不保存不落库', () => {
    const fresh = openDatabase(':memory:')
    expect(countSessions(fresh)).toBe(0)
    expect(countRings(fresh)).toBe(0)
  })
})
