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
  migrate(db)
  if (filePath !== ':memory:') chmodSync(filePath, 0o600)
  return db
}

/**
 * 幂等迁移。
 *
 * 建表用的是 CREATE TABLE IF NOT EXISTS，所以**老库不会自动获得新列**——
 * 加了列却不管老库，用户升级后会遇到 "no such column"。
 * 这里每一步都先查现状再动手，重复执行安全。
 */
function migrate(db: Database.Database): void {
  const columns = (table: string): string[] =>
    (db.prepare('PRAGMA table_info(' + table + ')').all() as Array<{ name: string }>).map((c) => c.name)

  // review.executed（布尔）→ review.outcome（四选一）。
  // 四选一是刻意的：情况变了、说不清都是真实结局，二元会逼用户把自己塞进"没做到"。
  if (!columns('review').includes('outcome')) {
    db.exec('ALTER TABLE review ADD COLUMN outcome TEXT')
    if (columns('review').includes('executed')) {
      // 老数据的近似回填：当时只有"做了/没做"，就把做到了映射成 done，其余归 not_done。
      db.exec(
        "UPDATE review SET outcome = CASE WHEN executed = 1 THEN 'done' ELSE 'not_done' END WHERE outcome IS NULL",
      )
    }
  }
}
