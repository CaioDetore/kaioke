# 004 — Reprodução e votação: requisitos

## Objetivo

Concluir a experiência de karaokê: vídeo e áudio no host, projeção de estado nos celulares, avanço automático e votação de pulo.

## Requisitos

- Somente host carrega YouTube IFrame Player API e produz áudio/vídeo.
- Com fila pendente e player ocioso, o primeiro item inicia automaticamente; término/falha inicia o próximo.
- Host pode play, pausa, seek e pular sempre.
- Autor da faixa ativa pode play/pausa e abrir voto de pulo; demais não-host conectados votam uma vez.
- O limiar é `ceil(60% × participantes conectados não-host)` e é recalculado em voto, entrada e saída. Host não vota e pode pular diretamente.
- Falha de embed marca item como `failed`, informa host/participantes e não bloqueia fila.
- Participante vê faixa atual, progresso, estado e votação, sem miniplayer local.

## Aceite

- Player inicia, pausa, avança e sincroniza estado observável em dois participantes.
- Permissões de host, autor e demais participantes são aplicadas pelo servidor.
- Voto alcançado e mudança de presença cumprem limiar esperado.
- Falha simulada de YouTube não impede a próxima faixa.
