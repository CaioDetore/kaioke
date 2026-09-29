# 002 — Host e sessão LAN: design

## Arquitetura

`src/main/session-server` cria servidor HTTP e WebSocket. O HTTP entrega o bundle do participante; o WS mantém a sessão em memória. O main Electron inicia/paralisa esse módulo e expõe seu estado ao renderer host via preload.

1. `ready → starting → accepting → stopping → ready` é a máquina de estados do host.
2. Em `starting`, escolhe IP privado, porta livre e token criptograficamente aleatório.
3. QR usa `http://<ip>:<porta>/join?token=<token>`.
4. Apenas em `accepting` o WS aceita `session:join`; toda mutação futura será validada no servidor.

## Protocolo desta entrega

- Cliente → servidor: `session:join`.
- Servidor → cliente: `session:snapshot`, `participant:changed`, `error`, `session:ended`.
- Eventos possuem `revision` monotônica. Cliente ignora atualização cuja revisão não exceda a última aplicada.
- Reconexão tem backoff limitado e só fica conectada após aplicar snapshot completo.

## Persistência

Usar SQLite no diretório de dados Electron, com `schemaVersion`. Persistir somente itens de fila restauráveis. Antes de uma migração incompatível, criar backup local. Ao carregar, status `playing` é convertido em `queued`; `failed` e `completed` são descartados.

## Segurança operacional

O token é segredo temporário de entrada, não identidade. Autorizações futuras usarão `deviceId`. HTTP/WS sem TLS é aceitável exclusivamente na Wi-Fi privada prevista; não há exposição à internet nem promessa de defesa contra participante malicioso.
