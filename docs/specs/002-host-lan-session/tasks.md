# 002 — Host e sessão LAN: tarefas e validação

## Implementação

- [ ] Implementar lifecycle IPC do host e apresentação de estado/QR na tela host.
- [ ] Implementar seleção de IPv4, bind HTTP/WS, token e rota `/join`.
- [ ] Implementar handshake, presença, snapshot, revisão e encerramento de sessão.
- [ ] Implementar reconexão de cliente com backoff e substituição por snapshot.
- [ ] Implementar repositório SQLite, schemaVersion, restauração e backup pré-migração.
- [ ] Mapear erros de rede/firewall/porta para feedback de host e participante.

## Validação de encerramento

- [ ] Testes de integração para token válido/inválido, duas conexões, snapshot, presença e reconexão.
- [ ] Teste de persistência prova restauração e conversão de item `playing` para `queued`.
- [ ] E2E inicia o host e abre a URL do QR em navegador separado.
- [ ] Teste manual em Wi-Fi real verifica IP exibido, firewall e encerramento do host.
- [ ] Registrar aprovação da spec antes de iniciar a 003.
