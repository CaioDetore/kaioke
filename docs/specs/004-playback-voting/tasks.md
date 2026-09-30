# 004 — Reprodução e votação: tarefas e validação

## Implementação

- [x] Integrar IFrame Player API em componente exclusivo do host e mapear eventos para estado compartilhado.
- [x] Implementar seleção de próximo item, avanço automático e marcação de item falho/concluído.
- [x] Implementar comandos e autorização de host/autor no servidor.
- [x] Implementar voto, limiar de 60%, recálculo por presença e limpeza de votos na troca de faixa.
- [x] Criar player host e projeção mobile de faixa, progresso e voto; limitar emissão de progresso.
- [x] Criar guia operacional de release Windows, firewall e teste Wi-Fi.

## Validação de encerramento

- [ ] Unitários para autorização, quorum em 0/1/N participantes, limpeza de voto e seleção da próxima faixa.
- [x] Integração com player simulado para play, pausa, fim, erro, pulo host e voto de participantes.
- [ ] E2E host + dois participantes: adicionar músicas, reproduzir, votar, pular e avançar após erro.
- [ ] Teste manual Android/iOS na mesma Wi-Fi: QR, legibilidade, área de toque, áudio exclusivo do host e reconexão.
- [ ] Executar checklist final de build Windows, dados persistidos, falhas de rede e acessibilidade; registrar aprovação da entrega v1.
