import type { HostSessionState } from '../main/session-server'
import type { Participant, PlaybackState, QueueItem, SkipVote } from '../shared/domain'

export type SessionSnapshot = { revision: number; participants: Participant[]; queue: QueueItem[]; playback: PlaybackState; skipVote?: SkipVote }

export interface KaiokeApi {
  app: {
    getVersion: () => Promise<string>
  }
  session: {
    getState: () => Promise<HostSessionState>
    start: () => Promise<HostSessionState>
    stop: () => Promise<HostSessionState>
    getSnapshot: () => Promise<SessionSnapshot>
    removeQueueItem: (queueItemId: string) => Promise<SessionSnapshot>
    reorderQueueItem: (queueItemId: string, targetIndex: number) => Promise<SessionSnapshot>
    playbackCommand: (command: { action: 'loading' | 'play' | 'pause' | 'seek' | 'ended' | 'error' | 'skip'; positionSeconds?: number }) => Promise<SessionSnapshot>
    toggleFullscreen: () => Promise<boolean>
    onStateChanged: (listener: (state: HostSessionState) => void) => () => void
  }
}
