import { z } from 'zod'

export const protocolVersion = 1 as const
export const messageTypes = [
  'session.join',
  'session:join',
  'session:snapshot',
  'participant:changed',
  'profile:update',
  'session:ended',
  'queue.add',
  'queue.remove',
  'queue.reorder',
  'queue:changed',
  'playback.sync',
  'playback:command',
  'playback:changed',
  'skip:vote',
  'skip:changed',
  'error',
] as const
export type MessageType = (typeof messageTypes)[number]

export const websocketEnvelopeSchema = z.object({
  version: z.literal(protocolVersion),
  type: z.enum(messageTypes),
  requestId: z.string().min(1).optional(),
  payload: z.unknown(),
})

export type WebSocketEnvelope = z.infer<typeof websocketEnvelopeSchema>
