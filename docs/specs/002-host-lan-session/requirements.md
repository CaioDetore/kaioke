# 002 — Host e sessão LAN: requisitos

## Objetivo

Permitir que o host Windows abra uma única sessão LAN protegida por token e que navegadores na mesma Wi-Fi entrem, recebam estado autoritativo e recuperem a última fila local.

## Requisitos

- Host deve iniciar/parar sessão e mostrar QR, URL LAN e estado de rede somente após o serviço ficar pronto.
- Serviço local deve selecionar/exibir IPv4 privado alcançável, servir a interface participante por HTTP e manter WebSocket autenticado por token aleatório.
- Uma sessão aceita `session:join` com `token`, `deviceId` e nome válido; token inválido não expõe snapshot.
- Host mantém participantes conectados e distribui `session:snapshot` em toda entrada/reconexão.
- Queda do cliente deve entrar em reconexão; queda/encerramento do host encerra a sessão para participantes, sem eleição de host.
- Última fila persistida deve restaurar após reabrir o app. Presença, votos e reprodução não persistem.
- Falhas de IP, porta, servidor e firewall recebem mensagem acionável no host; sessão parcialmente iniciada deve ser limpa.

## Fora de escopo

Perfil editável, criação de pedidos, reordenação, YouTube e votação.

## Aceite

- Dois browsers locais conectam por URL/QR e recebem snapshots equivalentes.
- Token errado é recusado; cliente reconectado recebe estado atualizado.
- Fechar/reabrir o host restaura uma fila fixture e a converte em pendente.
- Teste de integração cobre entrada, saída, reconexão e encerramento da sessão.
