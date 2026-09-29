import { createServer, type Server } from 'node:http'
import { networkInterfaces } from 'node:os'
import { randomBytes } from 'node:crypto'
import QRCode from 'qrcode'
import { WebSocket, WebSocketServer } from 'ws'
import type { Participant, QueueItem } from '../shared/domain'
import { websocketEnvelopeSchema } from '../shared/protocol'
import type { QueueRepository } from './queue-repository'

export type HostSessionPhase = 'ready' | 'starting' | 'accepting' | 'stopping' | 'error'

export interface HostSessionState {
  phase: HostSessionPhase
  url?: string
  qrCodeDataUrl?: string
  ip?: string
  port?: number
  participantCount: number
  error?: string
}

type SessionSnapshot = { revision: number; participants: Participant[]; queue: QueueItem[] }
type SessionServerOptions = { repository?: QueueRepository; selectIp?: () => string | undefined }

const participantPage = `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar no Kaioke</title><style>body{font:16px system-ui;background:#0b0b12;color:#f4f1ff;margin:0;display:grid;min-height:100vh;place-items:center}main{width:min(100% - 32px,420px);padding:28px;border:1px solid #302d45;border-radius:20px;background:#151521}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:12px;border-radius:10px;font:inherit}input{border:1px solid #302d45;background:#0b0b12;color:#fff}button{border:0;background:#9566ff;color:#fff;font-weight:700}p{color:#aaa6bc}#status{min-height:24px}</style><main><h1>Kaioke</h1><p>Entre na sessão do host.</p><form><label for="name">Seu nome</label><input id="name" maxlength="48" required autocomplete="name" placeholder="Como quer aparecer?"><button>Entrar</button></form><p id="status" role="status"></p></main><script>const status=document.querySelector('#status'),form=document.querySelector('form'),name=document.querySelector('#name'),token=new URLSearchParams(location.search).get('token'),deviceId=localStorage.kaiokeDeviceId||(localStorage.kaiokeDeviceId=crypto.randomUUID());let socket,attempt=0,ended=false;form.onsubmit=e=>{e.preventDefault();ended=false;attempt=0;connect()};function connect(){if(ended)return;status.textContent=attempt?'Reconectando…':'Conectando…';socket=new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host);socket.onopen=()=>socket.send(JSON.stringify({version:1,type:'session:join',payload:{token,deviceId,displayName:name.value.trim()}}));socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='session:snapshot'){attempt=0;status.textContent='Conectado. Aguarde a próxima música.'}else if(m.type==='session:ended'){ended=true;status.textContent='A sessão do host foi encerrada.';socket.close()}else if(m.type==='error'){ended=true;status.textContent=m.payload.message;socket.close()}};socket.onclose=()=>{if(!ended){attempt=Math.min(attempt+1,6);const delay=Math.min(1000*2**attempt,15000);status.textContent='Conexão perdida. Tentando novamente…';setTimeout(connect,delay)}};socket.onerror=()=>socket.close()}}</script></html>`

// HTTP on a private LAN is not a secure context in every mobile browser, so
// this fallback deliberately does not depend on crypto.randomUUID().
const participantRecoveryScript = `<script>(()=>{const status=document.querySelector('#status'),form=document.querySelector('form'),name=document.querySelector('#name'),token=new URLSearchParams(location.search).get('token'),deviceId=localStorage.kaiokeDeviceId||(localStorage.kaiokeDeviceId='device-'+Date.now()+'-'+Math.random().toString(36).slice(2));let socket,attempt=0,ended=false;form.onsubmit=e=>{e.preventDefault();if(!token){status.textContent='Link de entrada inválido.';return}ended=false;attempt=0;connect()};function connect(){if(ended)return;status.textContent=attempt?'Reconectando…':'Conectando…';socket=new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host);socket.onopen=()=>socket.send(JSON.stringify({version:1,type:'session:join',payload:{token,deviceId,displayName:name.value.trim()}}));socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='session:snapshot'){attempt=0;status.textContent='Conectado. Aguarde a próxima música.'}else if(m.type==='session:ended'){ended=true;status.textContent='A sessão do host foi encerrada.';socket.close()}else if(m.type==='error'){ended=true;status.textContent=m.payload.message;socket.close()}};socket.onclose=()=>{if(!ended){attempt=Math.min(attempt+1,6);status.textContent='Conexão perdida. Tentando novamente…';setTimeout(connect,Math.min(1000*2**attempt,15000))}};socket.onerror=()=>socket.close()}})()</script>`
const participantDuplicateGuard = `<script>(()=>{const form=document.querySelector('form'),submit=form.querySelector('button'),existing=form.onsubmit;form.onsubmit=e=>{if(form.dataset.joining==='true'){e.preventDefault();return}form.dataset.joining='true';submit.disabled=true;return existing.call(form,e)}})()</script>`
const participantPageWithRecovery = `${participantPage}${participantRecoveryScript}${participantDuplicateGuard}`

export class SessionServer {
  private httpServer?: Server
  private webSocketServer?: WebSocketServer
  private readonly clients = new Map<WebSocket, Participant>()
  private readonly clientsByDevice = new Map<string, WebSocket>()
  private readonly listeners = new Set<(state: HostSessionState) => void>()
  private state: HostSessionState = { phase: 'ready', participantCount: 0 }
  private token = ''
  private revision = 0
  private queue: QueueItem[] = []

  constructor(private readonly options: SessionServerOptions = {}) {}

  getState(): HostSessionState { return this.state }
  onState(listener: (state: HostSessionState) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  async start(): Promise<HostSessionState> {
    if (this.state.phase === 'accepting' || this.state.phase === 'starting') return this.state
    this.setState({ phase: 'starting', participantCount: 0 })
    try {
      const ip = (this.options.selectIp ?? selectPrivateIpv4)()
      if (!ip) throw new Error('Nenhum IPv4 privado foi encontrado. Conecte-se à rede Wi‑Fi e tente novamente.')
      this.queue = await this.options.repository?.loadQueue() ?? []
      this.token = randomBytes(24).toString('base64url')
      this.httpServer = createServer((request, response) => {
        if (request.url?.startsWith('/join')) { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); response.end(participantPageWithRecovery); return }
        response.writeHead(302, { location: '/join' }); response.end()
      })
      this.webSocketServer = new WebSocketServer({ noServer: true })
      this.httpServer.on('upgrade', (request, socket, head) => this.webSocketServer?.handleUpgrade(request, socket, head, client => this.attachClient(client)))
      const port = await listen(this.httpServer)
      const url = `http://${ip}:${port}/join?token=${this.token}`
      this.setState({ phase: 'accepting', ip, port, url, qrCodeDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 280 }), participantCount: 0 })
    } catch (cause) {
      await this.closeServers()
      this.setState({ phase: 'error', participantCount: 0, error: networkErrorMessage(cause) })
    }
    return this.state
  }

  async stop(): Promise<HostSessionState> {
    if (this.state.phase === 'ready') return this.state
    this.setState({ ...this.state, phase: 'stopping' })
    this.broadcast('session:ended', { message: 'A sessão do host foi encerrada.' })
    await this.options.repository?.saveQueue(this.queue)
    await this.closeServers()
    this.clients.clear(); this.token = ''
    this.setState({ phase: 'ready', participantCount: 0 })
    return this.state
  }

  private attachClient(client: WebSocket): void {
    client.once('message', raw => {
      const parsed = websocketEnvelopeSchema.safeParse(parseJson(raw.toString()))
      const payload = parsed.success && parsed.data.type === 'session:join' ? parsed.data.payload : undefined
      if (!payload || !isJoinPayload(payload) || payload.token !== this.token || this.state.phase !== 'accepting') { this.send(client, 'error', { message: 'Entrada não autorizada.' }); client.close(1008, 'Unauthorized'); return }
      const participant: Participant = { deviceId: payload.deviceId, displayName: payload.displayName.trim(), connectedAt: new Date().toISOString(), isHost: false }
      const previousClient = this.clientsByDevice.get(participant.deviceId)
      if (previousClient && previousClient !== client) {
        this.clients.delete(previousClient)
        previousClient.close(4001, 'Reconnected from another connection')
      }
      this.clients.set(client, participant); this.clientsByDevice.set(participant.deviceId, client); this.send(client, 'session:snapshot', this.snapshot())
      this.participantsChanged()
      client.on('close', () => this.detachClient(client))
    })
  }

  private detachClient(client: WebSocket): void {
    const participant = this.clients.get(client)
    if (!this.clients.delete(client)) return
    if (participant && this.clientsByDevice.get(participant.deviceId) === client) this.clientsByDevice.delete(participant.deviceId)
    this.participantsChanged()
  }
  private participantsChanged(): void { this.revision += 1; this.broadcast('participant:changed', { revision: this.revision, participants: [...this.clients.values()] }); this.setState({ ...this.state, participantCount: this.clients.size }) }
  private snapshot(): SessionSnapshot { return { revision: this.revision, participants: [...this.clients.values()], queue: this.queue } }
  private broadcast(type: string, payload: unknown): void { for (const client of this.clients.keys()) this.send(client, type, payload) }
  private send(client: WebSocket, type: string, payload: unknown): void { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ version: 1, type, payload })) }
  private setState(state: HostSessionState): void { this.state = state; this.listeners.forEach(listener => listener(state)) }
  private async closeServers(): Promise<void> { for (const client of this.clients.keys()) client.close(); await Promise.all([close(this.webSocketServer), close(this.httpServer)]); this.clientsByDevice.clear(); this.webSocketServer = undefined; this.httpServer = undefined }
}

function selectPrivateIpv4(): string | undefined { for (const addresses of Object.values(networkInterfaces())) for (const address of addresses ?? []) { if (address.family !== 'IPv4' || address.internal) continue; const [first, second] = address.address.split('.').map(Number); if (first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)) return address.address } }
function parseJson(raw: string): unknown { try { return JSON.parse(raw) } catch { return undefined } }
function isJoinPayload(value: unknown): value is { token: string; deviceId: string; displayName: string } { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return typeof item.token === 'string' && typeof item.deviceId === 'string' && item.deviceId.length > 0 && typeof item.displayName === 'string' && item.displayName.trim().length > 0 && item.displayName.trim().length <= 48 }
function listen(server: Server): Promise<number> { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', () => { server.off('error', reject); resolve((server.address() as { port: number }).port) }) }) }
function close(server: { close(callback: (error?: Error) => void): void } | undefined): Promise<void> { return new Promise(resolve => server ? server.close(() => resolve()) : resolve()) }
function networkErrorMessage(cause: unknown): string { const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''; if (code === 'EADDRINUSE') return 'A porta escolhida já está em uso. Tente iniciar a sessão novamente.'; if (code === 'EACCES') return 'O Windows bloqueou a abertura da porta. Verifique o firewall e tente novamente.'; return cause instanceof Error ? cause.message : 'Não foi possível iniciar o servidor local.' }
