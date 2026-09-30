import type { QueueItem } from './domain'

export type QueueRuleError = 'INVALID_VIDEO' | 'DUPLICATE_VIDEO' | 'QUEUE_LIMIT' | 'NOT_AUTHORIZED' | 'ITEM_NOT_FOUND' | 'ITEM_NOT_QUEUED' | 'INVALID_REORDER'

export function normalizeYouTubeInput(input: string): { videoId: string; sourceUrl: string } | { error: 'INVALID_VIDEO' } {
  const value = input.trim()
  if (/^[\w-]{11}$/.test(value)) return video(value)
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let id: string | null = null
    if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      id = url.searchParams.get('v')
        ?? (/^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[1] ?? null)
    }
    return id && /^[\w-]{11}$/.test(id) ? video(id) : { error: 'INVALID_VIDEO' }
  } catch { return { error: 'INVALID_VIDEO' } }
}

export function canAddQueueItem(queue: QueueItem[], requestedBy: string, videoId: string): QueueRuleError | undefined {
  if (queue.some(item => item.videoId === videoId && (item.status === 'queued' || item.status === 'playing'))) return 'DUPLICATE_VIDEO'
  if (queue.filter(item => item.requestedBy === requestedBy && item.status === 'queued').length >= 3) return 'QUEUE_LIMIT'
}

export function canRemoveQueueItem(queue: QueueItem[], actorId: string, itemId: string, isHost = false): QueueRuleError | undefined {
  const item = queue.find(entry => entry.id === itemId)
  if (!item) return 'ITEM_NOT_FOUND'
  if (!isHost && item.requestedBy !== actorId) return 'NOT_AUTHORIZED'
  if (item.status !== 'queued') return 'ITEM_NOT_QUEUED'
}

export function canReorderQueue(queue: QueueItem[], actorIsHost: boolean, itemId: string, targetIndex: number): QueueRuleError | undefined {
  if (!actorIsHost) return 'NOT_AUTHORIZED'
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= queue.filter(item => item.status === 'queued').length) return 'INVALID_REORDER'
  if (!queue.some(item => item.id === itemId && item.status === 'queued')) return 'ITEM_NOT_QUEUED'
}

export function reorderQueuedItem(queue: QueueItem[], itemId: string, targetIndex: number): QueueItem[] {
  const queued = queue.filter(item => item.status === 'queued')
  const movedIndex = queued.findIndex(item => item.id === itemId)
  const [moved] = queued.splice(movedIndex, 1)
  queued.splice(targetIndex, 0, moved)
  let index = 0
  return queue.map(item => item.status === 'queued' ? queued[index++] : item)
}

function video(videoId: string): { videoId: string; sourceUrl: string } { return { videoId, sourceUrl: `https://www.youtube.com/watch?v=${videoId}` } }
