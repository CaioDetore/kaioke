# 001 — Fundação: design

## Estrutura criada

```text
src/
  main/            ciclo Electron; sem lógica LAN nesta spec
  preload/         bridge tipada e allowlist de canais IPC
  renderer/
    components/    componentes reutilizáveis Base UI/shadcn
    pages/         HostReadyPage temporária
    styles/        tokens, fontes e tema
  shared/          domain, protocol, schemas, errors
tests/ unit | integration | e2e
```

## Decisões

- Usar TypeScript estrito e schemas Zod (ou equivalente com inferência TypeScript) para validar limites de rede no runtime.
- Todo evento futuro terá envelope `{ version: 1, type, requestId?, payload }`; versões ou tipos desconhecidos serão rejeitados pelo servidor futuro.
- `lucide-react` é a única biblioteca de ícones. Botões exclusivamente icônicos exigem `aria-label` e tooltip.
- Tokens de tema incluem superfícies, texto, borda, foco, sucesso, erro, violeta e ciano; movimento fica atrás de `prefers-reduced-motion`.

## Contratos iniciais

- `Participant`: `deviceId`, `displayName`, `connectedAt`, `isHost`.
- `QueueItem`: `id`, `videoId`, `sourceUrl`, `title?`, `channelName?`, `requestedBy`, `createdAt`, `status`.
- `PlaybackState` e `SkipVote` são definidos, mas não possuem comportamento nesta spec.
- Códigos de erro começam com `INVALID_PAYLOAD`, `UNAUTHORIZED`, `INVALID_VIDEO`, `DUPLICATE_VIDEO`, `QUEUE_LIMIT`, `SESSION_UNAVAILABLE`.
