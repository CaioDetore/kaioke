import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { QueueRepository } from '../../src/main/queue-repository'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true })))

describe('QueueRepository', () => {
  it('restores only pending entries and returns playing entries to queued', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'kaioke-queue-'))
    directories.push(directory)
    const databasePath = path.join(directory, 'kaioke.sqlite')
    const repository = await QueueRepository.open(databasePath)
    const base = { videoId: 'video', sourceUrl: 'https://youtube.com/watch?v=video', requestedBy: 'device', createdAt: '2026-01-01T00:00:00.000Z' }
    await repository.saveQueue([
      { ...base, id: 'playing', status: 'playing' },
      { ...base, id: 'queued', status: 'queued' },
      { ...base, id: 'played', status: 'played' },
    ])
    repository.close()

    const reopened = await QueueRepository.open(databasePath)
    await expect(reopened.loadQueue()).resolves.toEqual([
      { ...base, id: 'playing', status: 'queued' },
      { ...base, id: 'queued', status: 'queued' },
    ])
    reopened.close()
  })
})
