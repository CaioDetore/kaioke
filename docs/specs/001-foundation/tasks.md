# 001 — Fundação: tarefas e validação

## Implementação

- [x] Criar scaffold Electron/React/Vite/TypeScript e scripts de dev, build, typecheck e lint.
- [x] Criar `main`, `preload`, `renderer` e `shared`; aplicar isolamento de contexto e bridge IPC com allowlist.
- [x] Instalar/configurar shadcn/ui Base UI, Tailwind e `lucide-react`; criar tokens e componentes-base.
- [x] Criar schemas, tipos, envelope protocolar e erros compartilhados.
- [x] Configurar Vitest, testes de integração e Playwright com uma fixture mínima.

## Validação de encerramento

- [x] Executar build e typecheck sem erros.
- [x] Executar teste unitário de schema válido/inválido e teste de importação dos contratos por main e renderer.
- [x] Executar E2E que abre a janela host em `ready`.
- [ ] Revisar manualmente foco, contraste, alvos de toque e `prefers-reduced-motion` na tela-base.
- [ ] Registrar aprovação da spec antes de iniciar a 002.
