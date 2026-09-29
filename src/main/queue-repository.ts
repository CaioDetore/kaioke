import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { QueueItem } from '../shared/domain'
import { queueItemSchema } from '../shared/schemas'

const schemaVersion = 1

export class QueueRepository {
  private constructor(private database: Database, private readonly databasePath: string) {}

  static async open(databasePath: string): Promise<QueueRepository> {
    mkdirSync(path.dirname(databasePath), { recursive: true })
    const SQL = await loadSqlJs()
    const database = existsSync(databasePath) ? new SQL.Database(readFileSync(databasePath)) : new SQL.Database()
    const repository = new QueueRepository(database, databasePath)
    repository.migrate()
    return repository
  }

  async loadQueue(): Promise<QueueItem[]> {
    const result = this.database.exec('SELECT payload, status FROM queue_items ORDER BY created_at ASC')[0]
    const restored: QueueItem[] = []
    for (const row of result?.values ?? []) {
      const [payload, status] = row as [string, string]
      if (status === 'played' || status === 'skipped' || status === 'failed' || status === 'completed') continue
      try {
        const item = JSON.parse(payload) as QueueItem
        const parsed = queueItemSchema.safeParse({ ...item, status: status === 'playing' ? 'queued' : item.status })
        if (parsed.success) restored.push(parsed.data)
      } catch { /* Corrupted entries are deliberately ignored during recovery. */ }
    }
    return restored
  }

  async saveQueue(items: QueueItem[]): Promise<void> {
    this.database.run('BEGIN')
    try {
      this.database.run('DELETE FROM queue_items')
      for (const item of items) this.database.run('INSERT INTO queue_items (id, payload, status, created_at) VALUES (?, ?, ?, ?)', [item.id, JSON.stringify(item), item.status, item.createdAt])
      this.database.run('COMMIT')
      this.persist()
    } catch (error) {
      this.database.run('ROLLBACK')
      throw error
    }
  }

  close(): void { this.persist(); this.database.close() }

  private migrate(): void {
    this.database.run('CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    const currentVersion = Number(this.scalar("SELECT value FROM app_metadata WHERE key = 'schemaVersion'", 0))
    if (currentVersion > schemaVersion) throw new Error('O banco de dados foi criado por uma versão mais nova do Kaioke.')
    if (currentVersion !== schemaVersion && currentVersion > 0 && existsSync(this.databasePath)) copyFileSync(this.databasePath, `${this.databasePath}.v${currentVersion}.bak`)
    this.database.run('CREATE TABLE IF NOT EXISTS queue_items (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)')
    this.database.run("INSERT INTO app_metadata (key, value) VALUES ('schemaVersion', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(schemaVersion)])
    this.persist()
  }

  private scalar(query: string, fallback: string | number): string | number {
    const value = this.database.exec(query)[0]?.values[0]?.[0]
    return typeof value === 'string' || typeof value === 'number' ? value : fallback
  }

  private persist(): void {
    const temporaryPath = `${this.databasePath}.tmp`
    writeFileSync(temporaryPath, this.database.export())
    renameSync(temporaryPath, this.databasePath)
  }
}

async function loadSqlJs(): Promise<SqlJsStatic> {
  return initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) })
}
