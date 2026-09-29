# 003 — Participante e fila: requisitos

## Objetivo

Entregar perfil local e fila compartilhada autoritativa, utilizável em celular, sem ainda reproduzir vídeos.

## Requisitos

- Primeiro acesso pede nome após trim entre 1 e 32 caracteres; `deviceId` e nome persistem em `localStorage`.
- Nomes duplicados são aceitos; UI diferencia visualmente apenas quando necessário.
- Participante e host adicionam URL YouTube canônica, curta ou ID de 11 caracteres.
- Item válido entra no fim; duplicata da faixa ativa ou pendente é rejeitada; item falho/concluído não bloqueia reenvio.
- Cada identidade possui no máximo três itens `queued`.
- Autor remove apenas seus itens pendentes; host remove qualquer item pendente e reordena apenas itens pendentes.
- Clientes exibem fila, autoria, posição, feedback de operação e estados de conexão; host não precisa de player nesta entrega.

## Fora de escopo

IFrame YouTube, reprodução, progresso, comandos e voto.

## Aceite

- Atualizar perfil e recarregar navegador preserva nome/ID.
- Todas as regras de fila são recusadas no servidor mesmo com cliente forjado.
- Dois participantes observam ordenação idêntica após adicionar, remover e reordenar.
- Mobile de 320 px permite concluir os fluxos sem hover ou rolagem horizontal.
