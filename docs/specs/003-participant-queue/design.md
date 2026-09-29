# 003 — Participante e fila: design

## Estado e persistência

Perfil local é `{ deviceId: UUID, displayName }` em `localStorage`; nenhum token ou snapshot é persistido no browser. O servidor mantém fila na sessão e atualiza SQLite da spec 002 após cada alteração bem-sucedida.

## Regras puras

- `normalizeYouTubeInput` retorna um ID normalizado ou erro `INVALID_VIDEO`.
- `canAddQueueItem` confere duplicata em `queued`/`playing` e máximo de três `queued` por autor.
- `canRemoveQueueItem` permite host ou autor, desde que não seja `playing`.
- `canReorderQueue` permite somente host e índices de `queued`.

## Eventos

- Cliente → host: `profile:update`, `queue:add`, `queue:remove`, `queue:reorder`.
- Host → cliente: `participant:changed`, `queue:changed`, `error`.
- Toda operação mutável tem `requestId`; repetição do mesmo pedido não pode produzir segundo item.

## UI

A página participante é mobile-first: título da sessão/conexão, botão “Adicionar música”, input único de URL/ID, fila em lista e menu de perfil. Host reutiliza a lista, adicionando drag/reordenação e remoção administrativa. Ícones Lucide acompanham ações com rótulos; erros aparecem em texto e toast acessível.
