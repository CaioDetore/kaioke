# Kaioke

Aplicativo de karaokê para uma única sessão na rede Wi-Fi local. Um computador Windows atua como host, exibe e reproduz o vídeo; participantes entram pelo QR code em seus próprios dispositivos para enviar músicas e acompanhar a fila.

## Status

O projeto está na fase de especificação. Não há código de produto nem dependências instaladas ainda.

## Specs de desenvolvimento

As specs são incrementais. Cada uma contém requisitos, design, tarefas e sua própria validação antes que a próxima comece.

1. [001 — Fundação](docs/specs/001-foundation/requirements.md)
2. [002 — Host e sessão LAN](docs/specs/002-host-lan-session/requirements.md)
3. [003 — Participante e fila](docs/specs/003-participant-queue/requirements.md)
4. [004 — Reprodução e votação](docs/specs/004-playback-voting/requirements.md)

## Governança

`requirements.md` define o que será entregue; `design.md` define como; `tasks.md` organiza a execução. Mudanças de escopo atualizam primeiro os requisitos. Decisões arquiteturais que alterem o design recebem um ADR em `docs/adr/`.

O desenvolvimento começa após a aprovação explícita das três specs.
