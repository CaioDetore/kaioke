import type { KaiokeApi } from './api'

declare global {
  interface Window {
    kaioke: KaiokeApi
  }
}

export {}
