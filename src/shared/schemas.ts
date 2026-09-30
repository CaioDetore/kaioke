import { z } from 'zod'

export const participantSchema = z.object({
  deviceId: z.string().min(1).max(128),
  displayName: z.string().trim().min(1).max(32),
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
  requestedByName: z.string().trim().min(1).max(32).optional(),
  createdAt: z.string().datetime(),
  status: z.enum(['queued', 'playing', 'played', 'skipped', 'failed']),
})

export const playbackStateSchema = z.object({
  queueItemId: z.string().min(1).optional(),
  status: z.enum(['idle', 'loading', 'playing', 'paused']),
  positionSeconds: z.number().nonnegative(),
  updatedAt: z.string().datetime(),
})

export const skipVoteSchema = z.object({
  queueItemId: z.string().min(1),
  voterDeviceIds: z.array(z.string().min(1)),
  threshold: z.number().int().nonnegative(),
})
