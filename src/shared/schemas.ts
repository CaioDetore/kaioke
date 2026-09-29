import { z } from 'zod'

export const participantSchema = z.object({
  deviceId: z.string().min(1).max(128),
  displayName: z.string().trim().min(1).max(48),
  connectedAt: z.string().datetime(),
  isHost: z.boolean(),
})

export const queueItemSchema = z.object({
  id: z.string().min(1),
  videoId: z.string().min(1),
  sourceUrl: z.string().url(),
  title: z.string().min(1).optional(),
  channelName: z.string().min(1).optional(),
  requestedBy: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.enum(['queued', 'playing', 'played', 'skipped']),
})

export const playbackStateSchema = z.object({
  queueItemId: z.string().min(1).optional(),
  positionSeconds: z.number().nonnegative(),
  isPlaying: z.boolean(),
})

export const skipVoteSchema = z.object({
  queueItemId: z.string().min(1),
  participantId: z.string().min(1),
  createdAt: z.string().datetime(),
})
