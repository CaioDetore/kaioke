export type QueueItemStatus = 'queued' | 'playing' | 'played' | 'skipped'

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
  createdAt: string
  status: QueueItemStatus
}

export interface PlaybackState {
  queueItemId?: string
  positionSeconds: number
  isPlaying: boolean
}

export interface SkipVote {
  queueItemId: string
  participantId: string
  createdAt: string
}
