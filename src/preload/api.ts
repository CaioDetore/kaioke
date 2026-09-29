export interface KaiokeApi {
  app: {
    getVersion: () => Promise<string>
  }
}
