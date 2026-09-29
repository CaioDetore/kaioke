# 003 — Participante e fila: tarefas e validação

## Implementação

- [ ] Criar armazenamento de perfil, diálogo de primeiro acesso e edição de nome.
- [ ] Criar cliente WebSocket para os eventos de perfil/fila e estados conectando, conectado e reconectando.
- [ ] Implementar regras puras e handlers autoritativos de adicionar/remover/reordenar.
- [ ] Implementar normalização de URL/ID, feedback de validação e rótulo provisório por `videoId`.
- [ ] Criar UI participante mobile e painel de fila do host, incluindo permissões e reordenação.

## Validação de encerramento

- [ ] Unitários para nome, normalização, limite, duplicata e todas as combinações de autorização.
- [ ] Integração prova que `requestId` duplicado e cliente não autorizado não alteram fila.
- [ ] E2E com dois participantes cobre perfil persistido, adicionar, remover próprio, rejeitar quarto pedido e reordenação do host.
- [ ] Auditoria manual de 320 px, teclado, leitor de tela, contraste e estados de erro.
- [ ] Registrar aprovação da spec antes de iniciar a 004.
