import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { SessionServer } from '../../src/main/session-server'

const servers: SessionServer[] = []
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.stop())) })

function waitForMessage(socket: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise(resolve => socket.on('message', raw => {
    const message = JSON.parse(raw.toString()) as Record<string, unknown>
    if (message.type === type) resolve(message)
  }))
}

function join(url: string, token: string, deviceId: string): { socket: WebSocket; snapshot: Promise<Record<string, unknown>> } {
  const socket = new WebSocket(url)
  const snapshot = waitForMessage(socket, 'session:snapshot')
  socket.on('open', () => socket.send(JSON.stringify({ version: 1, type: 'session:join', payload: { token, deviceId, displayName: deviceId } })))
  return { socket, snapshot }
}

function send(socket: WebSocket, type: string, payload: Record<string, unknown>, requestId: string): void {
  socket.send(JSON.stringify({ version: 1, type, payload, requestId }))
}

describe('LAN session server', () => {
  it('does not mutate the queue for duplicate request IDs or an unauthorized removal', async () => {
    const server = new SessionServer({ selectIp: () => '127.0.0.1' })
    servers.push(server)
    const state = await server.start()
    const token = new URL(state.url!).searchParams.get('token')!
    const url = `ws://${state.ip}:${state.port}`
    const ana = join(url, token, 'ana'); await ana.snapshot
    const bia = join(url, token, 'bia'); await bia.snapshot
    const changed = waitForMessage(ana.socket, 'queue:changed')
    send(ana.socket, 'queue.add', { input: 'dQw4w9WgXcQ' }, 'add-once')
    send(ana.socket, 'queue.add', { input: 'dQw4w9WgXcQ' }, 'add-once')
    const queue = await changed
    const queueItemId = (queue.payload as { queue: Array<{ id: string }> }).queue[0].id
    const denied = waitForMessage(bia.socket, 'error')
    send(bia.socket, 'queue.remove', { queueItemId }, 'not-owner')
    await expect(denied).resolves.toMatchObject({ payload: { code: 'NOT_AUTHORIZED' } })
    await expect.poll(() => (server as unknown as { queue: unknown[] }).queue.length).toBe(1)
    ana.socket.close(); bia.socket.close()
  })

  it('lets the host remove and reorder pending requests', async () => {
    const server = new SessionServer({ selectIp: () => '127.0.0.1' })
    servers.push(server)
    const state = await server.start()
    const token = new URL(state.url!).searchParams.get('token')!
    const ana = join(`ws://${state.ip}:${state.port}`, token, 'ana'); await ana.snapshot
    const first = waitForMessage(ana.socket, 'queue:changed'); send(ana.socket, 'queue.add', { input: 'dQw4w9WgXcQ' }, 'first'); await first
    const second = waitForMessage(ana.socket, 'queue:changed'); send(ana.socket, 'queue.add', { input: 'aBcDeFgHiJ0' }, 'second'); await second
    const before = server.getSnapshot().queue
    const reordered = await server.reorderQueueAsHost(before[1].id, 0)
    expect(reordered.queue.map(item => item.id)).toEqual([before[1].id, before[0].id])
    const removed = await server.removeQueueItemAsHost(before[1].id)
    expect(removed.queue).toHaveLength(1)
    ana.socket.close()
  })

  it('rejects invalid tokens, publishes presence, supports reconnection and ends the session', async () => {
    const server = new SessionServer({ selectIp: () => '127.0.0.1' })
    servers.push(server)
    const state = await server.start()
    expect(state.phase).toBe('accepting')
    const url = `ws://${state.ip}:${state.port}`
    const token = new URL(state.url!).searchParams.get('token')!

    const rejected = new WebSocket(url)
    const rejectedClosed = new Promise<number>(resolve => rejected.on('close', code => resolve(code)))
    rejected.on('open', () => rejected.send(JSON.stringify({ version: 1, type: 'session:join', payload: { token: 'wrong', deviceId: 'intruder', displayName: 'Intruder' } })))
    await expect(rejectedClosed).resolves.toBe(1008)

    const first = join(url, token, 'ana')
    await expect(first.snapshot).resolves.toMatchObject({ type: 'session:snapshot' })
    const changed = waitForMessage(first.socket, 'participant:changed')
    const second = join(url, token, 'bia')
    await second.snapshot
    await expect(changed).resolves.toMatchObject({ payload: { participants: expect.arrayContaining([expect.objectContaining({ deviceId: 'ana' }), expect.objectContaining({ deviceId: 'bia' })]) } })

    const reconnected = join(url, token, 'ana')
    await expect(reconnected.snapshot).resolves.toMatchObject({ type: 'session:snapshot' })
    await expect.poll(() => server.getState().participantCount).toBe(2)
    const ended = waitForMessage(second.socket, 'session:ended')
    await server.stop()
    await expect(ended).resolves.toMatchObject({ payload: { message: expect.stringContaining('encerrada') } })
    second.socket.close(); reconnected.socket.close()
  })

  it('advances after player failure and skips when the 60% participant quorum votes', async () => {
    const server = new SessionServer({ selectIp: () => '127.0.0.1', resolveVideoMetadata: async () => undefined })
    servers.push(server)
    const state = await server.start()
    const token = new URL(state.url!).searchParams.get('token')!
    const url = `ws://${state.ip}:${state.port}`
    const ana = join(url, token, 'ana'); await ana.snapshot
    const bia = join(url, token, 'bia'); await bia.snapshot
    const caio = join(url, token, 'caio'); await caio.snapshot
    send(ana.socket, 'queue.add', { input: 'dQw4w9WgXcQ' }, 'first')
    await expect.poll(() => server.getSnapshot().playback.queueItemId).toBeTruthy()
    const firstId = server.getSnapshot().playback.queueItemId!
    send(bia.socket, 'queue.add', { input: 'aBcDeFgHiJ0' }, 'second')
    await expect.poll(() => server.getSnapshot().queue.filter(item => item.status === 'queued')).toHaveLength(1)
    send(ana.socket, 'skip:vote', {}, 'vote-ana')
    await expect.poll(() => server.getSnapshot().skipVote).toMatchObject({ queueItemId: firstId, threshold: 2, voterDeviceIds: ['ana'] })
    send(bia.socket, 'skip:vote', {}, 'vote-bia')
    await expect.poll(() => server.getSnapshot().playback.queueItemId).not.toBe(firstId)
    const secondId = server.getSnapshot().playback.queueItemId!
    await server.playbackCommandAsHost({ action: 'error' })
    await expect.poll(() => server.getSnapshot().queue.find(item => item.id === secondId)?.status).toBe('failed')
    ana.socket.close(); bia.socket.close(); caio.socket.close()
  })
})
