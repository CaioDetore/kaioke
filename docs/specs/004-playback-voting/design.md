# 004 — Reprodução e votação: design

## Player

`renderer/features/player` no host encapsula IFrame Player API e converte eventos `loading`, `playing`, `paused`, `ended` e `error` em comandos para o servidor. O servidor define o próximo item e emite `playback:changed`; o renderer participante apenas projeta esse estado.

`PlaybackState` contém `queueItemId?`, `status`, `positionSeconds` e `updatedAt`. Progresso é publicado com limitação de frequência; transições importantes são imediatas. Não tentar sincronismo de áudio entre browsers.

## Voto e autorização

Eventos cliente → host: `playback:command` e `skip:vote`. Eventos host → cliente: `playback:changed`, `skip:changed`, `queue:changed`, `error`.

O servidor mantém `SkipVote { queueItemId, voterDeviceIds }`. Troca de faixa zera votos. O servidor calcula o denominador por participantes conectados, exclui host e executa o pulo atômico ao atingir o limiar. Play/pausa do autor só é aceita quando ele coincide com `requestedBy` do item ativo; seek/pulo direto continuam exclusivos do host.

## UI

Host: player dominante, título em display, controles rotulados, progresso, votos e fila lateral. O modo apresentação ocupa toda a janela para projeção: vídeo central em destaque e faixa inferior com próximas, últimas tocadas e QR code de entrada. `P` alterna a apresentação, `F`/`F11` alterna tela cheia, `C` exibe/oculta os controles na projeção e `Esc` sai da apresentação. Enquanto a sessão estiver aberta, o processo principal bloqueia a suspensão do monitor.

Participante: cartão de faixa atual, progresso somente leitura, ação de play/pausa quando autorizada e botão de voto; nenhum iframe ou áudio local. O formulário de pedido fica desabilitado até a conexão ser confirmada. Animações de estado são curtas e desativáveis por preferência de redução de movimento.
