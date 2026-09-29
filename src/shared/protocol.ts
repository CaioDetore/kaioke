import { z } from 'zod'

export const protocolVersion = 1 as const
export const messageTypes = ['session.join', 'queue.add', 'playback.sync', 'error'] as const
export type MessageType = (typeof messageTypes)[number]

export const websocketEnvelopeSchema = z.object({
  version: z.literal(protocolVersion),
  type: z.enum(messageTypes),
  requestId: z.string().min(1).optional(),
  payload: z.unknown(),
})

export type WebSocketEnvelope = z.infer<typeof websocketEnvelopeSchema>
