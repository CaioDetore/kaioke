import type { HostSessionState } from '../main/session-server'

export interface KaiokeApi {
  app: {
    getVersion: () => Promise<string>
  }
  session: {
    getState: () => Promise<HostSessionState>
    start: () => Promise<HostSessionState>
    stop: () => Promise<HostSessionState>
    onStateChanged: (listener: (state: HostSessionState) => void) => () => void
  }
}
