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

describe('LAN session server', () => {
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
})
