import { describe, expect, it } from 'vitest'
import { websocketEnvelopeSchema } from '../../src/shared/protocol'
import type { KaiokeApi } from '../../src/preload/api'

describe('shared contracts', () => {
  it('is available to Electron code and validates a versioned envelope', () => {
    const api: KaiokeApi = {
      app: { getVersion: async () => '0.1.0' },
      session: {
        getState: async () => ({ phase: 'ready', participantCount: 0 }),
        start: async () => ({ phase: 'ready', participantCount: 0 }),
        stop: async () => ({ phase: 'ready', participantCount: 0 }),
        onStateChanged: () => () => undefined,
      },
    }
    expect(api.app.getVersion).toBeTypeOf('function')
    expect(websocketEnvelopeSchema.safeParse({ version: 1, type: 'queue.add', payload: {} }).success).toBe(true)
  })
})
