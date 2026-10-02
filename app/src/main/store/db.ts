import Database from 'better-sqlite3'
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { SCHEMA } from './schema'

/**
 * 打开数据库。目录权限 0700、文件 0600——这是 ADR-0002 里"不加密但要配套"的第一条。
 * 传 ':memory:' 时跳过建目录（测试用）。
 */
export function openDatabase(filePath: string): Database.Database {
  if (filePath !== ':memory:') {
    const dir = dirname(filePath)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    chmodSync(dir, 0o700)
  }
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  if (filePath !== ':memory:') chmodSync(filePath, 0o600)
  return db
}
