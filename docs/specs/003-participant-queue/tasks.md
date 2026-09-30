# 003 — Participante e fila: tarefas e validação

## Implementação

- [x] Criar armazenamento de perfil, diálogo de primeiro acesso e edição de nome.
- [x] Criar cliente WebSocket para os eventos de perfil/fila e estados conectando, conectado e reconectando.
- [x] Implementar regras puras e handlers autoritativos de adicionar/remover/reordenar.
- [x] Implementar normalização de URL/ID, feedback de validação e rótulo provisório por `videoId`.
- [x] Criar UI participante mobile e painel de fila do host, incluindo permissões e reordenação.

## Validação de encerramento

- [ ] Unitários para nome, normalização, limite, duplicata e todas as combinações de autorização.
- [x] Integração prova que `requestId` duplicado e cliente não autorizado não alteram fila.
- [x] E2E com dois participantes cobre perfil persistido, adicionar, remover próprio, rejeitar quarto pedido e reordenação do host.
- [x] Auditoria manual de 320 px, teclado, leitor de tela, contraste e estados de erro.
- [x] Registrar aprovação da spec antes de iniciar a 004.
