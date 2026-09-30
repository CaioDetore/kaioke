import { describe, expect, it } from 'vitest'
import { participantSchema } from '../../src/shared/schemas'

describe('participant schema', () => {
  const validParticipant = { deviceId: 'device-1', displayName: 'Ana', connectedAt: '2026-01-01T00:00:00.000Z', isHost: false }

  it('accepts a valid payload', () => expect(participantSchema.safeParse(validParticipant).success).toBe(true))
  it('rejects blank and overlong names', () => {
    expect(participantSchema.safeParse({ ...validParticipant, displayName: '' }).success).toBe(false)
    expect(participantSchema.safeParse({ ...validParticipant, displayName: 'a'.repeat(33) }).success).toBe(false)
  })
})
