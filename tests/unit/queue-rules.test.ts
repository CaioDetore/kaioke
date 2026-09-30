import { describe, expect, it } from 'vitest'
import { canAddQueueItem, canRemoveQueueItem, canReorderQueue, normalizeYouTubeInput, reorderQueuedItem } from '../../src/shared/queue-rules'
import type { QueueItem } from '../../src/shared/domain'

const item = (overrides: Partial<QueueItem> = {}): QueueItem => ({ id: 'one', videoId: 'dQw4w9WgXcQ', sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', requestedBy: 'ana', createdAt: new Date().toISOString(), status: 'queued', ...overrides })

describe('queue rules', () => {
  it('normalizes canonical, short URLs and an ID', () => {
    for (const input of ['dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']) expect(normalizeYouTubeInput(input)).toMatchObject({ videoId: 'dQw4w9WgXcQ' })
    expect(normalizeYouTubeInput('not a video')).toEqual({ error: 'INVALID_VIDEO' })
  })
  it('enforces duplicate and per-author queued limits', () => {
    expect(canAddQueueItem([item()], 'bia', 'dQw4w9WgXcQ')).toBe('DUPLICATE_VIDEO')
    expect(canAddQueueItem([item(), item({ id: 'two' }), item({ id: 'three' })], 'ana', 'aBcDeFgHiJ0')).toBe('QUEUE_LIMIT')
  })
  it('allows only the author or host to remove queued items', () => {
    expect(canRemoveQueueItem([item()], 'bia', 'one')).toBe('NOT_AUTHORIZED')
    expect(canRemoveQueueItem([item()], 'ana', 'one')).toBeUndefined()
    expect(canRemoveQueueItem([item()], 'bia', 'one', true)).toBeUndefined()
  })
  it('allows only the host to reorder queued items', () => {
    const queue = [item(), item({ id: 'two', videoId: 'aBcDeFgHiJ0' })]
    expect(canReorderQueue(queue, false, 'two', 0)).toBe('NOT_AUTHORIZED')
    expect(canReorderQueue(queue, true, 'two', 0)).toBeUndefined()
    expect(reorderQueuedItem(queue, 'two', 0).map(entry => entry.id)).toEqual(['two', 'one'])
  })
})
