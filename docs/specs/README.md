# Mapa de specs

Cada diretório é uma entrega vertical e contém `requirements.md`, `design.md` e `tasks.md`. A validação listada em sua própria `tasks.md` é requisito de encerramento da spec e pré-requisito para a seguinte.

| Ordem | Spec | Entrega validada |
| --- | --- | --- |
| 001 | [Fundação](001-foundation/requirements.md) | Shell Electron/React, contratos compartilhados, tema e infraestrutura de testes. |
| 002 | [Host e sessão LAN](002-host-lan-session/requirements.md) | Sessão única, QR, HTTP/WebSocket, presença, reconexão e fila persistida. |
| 003 | [Participante e fila](003-participant-queue/requirements.md) | Perfil local, UI mobile e regras autoritativas para pedidos. |
| 004 | [Reprodução e votação](004-playback-voting/requirements.md) | Player YouTube no host, avanço, permissões e votação de pulo. |

Não iniciar uma spec antes de registrar a aprovação da validação da anterior em sua `tasks.md`.
