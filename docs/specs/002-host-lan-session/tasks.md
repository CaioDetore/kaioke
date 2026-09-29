# 002 — Host e sessão LAN: tarefas e validação

## Implementação

- [x] Implementar lifecycle IPC do host e apresentação de estado/QR na tela host.
- [x] Implementar seleção de IPv4, bind HTTP/WS, token e rota `/join`.
- [x] Implementar handshake, presença, snapshot, revisão e encerramento de sessão.
- [x] Implementar reconexão de cliente com backoff e substituição por snapshot.
- [x] Implementar repositório SQLite, schemaVersion, restauração e backup pré-migração.
- [x] Mapear erros de rede/firewall/porta para feedback de host e participante.

## Validação de encerramento

- [x] Testes de integração para token válido/inválido, duas conexões, snapshot, presença e reconexão.
- [x] Teste de persistência prova restauração e conversão de item `playing` para `queued`.
- [x] E2E inicia o host e abre a URL do QR em navegador separado.
- [x] Teste manual em Wi-Fi real verifica IP exibido, firewall e encerramento do host.
- [x] Registrar aprovação da spec antes de iniciar a 003.
