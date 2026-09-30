export type QueueItemStatus = 'queued' | 'playing' | 'played' | 'skipped' | 'failed'

export interface Participant {
  deviceId: string
  displayName: string
  connectedAt: string
  isHost: boolean
}

export interface QueueItem {
  id: string
  videoId: string
  sourceUrl: string
  title?: string
  channelName?: string
  requestedBy: string
  requestedByName?: string
  createdAt: string
  status: QueueItemStatus
}

export interface PlaybackState {
  queueItemId?: string
  status: 'idle' | 'loading' | 'playing' | 'paused'
  positionSeconds: number
  updatedAt: string
}

export interface SkipVote {
  queueItemId: string
  voterDeviceIds: string[]
  threshold: number
}
