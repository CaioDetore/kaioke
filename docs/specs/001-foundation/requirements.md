# 001 — Fundação: requisitos

## Objetivo

Estabelecer uma base executável, tipada, testável e visualmente coerente para o aplicativo Windows, sem iniciar uma sessão LAN ou integrar YouTube.

## Requisitos

- Criar um único projeto Electron + React + Vite + TypeScript, com separação entre `main`, `preload`, `renderer` e `shared`.
- Expor do `preload` apenas uma API tipada e mínima; o renderer não pode acessar Node/Electron diretamente.
- Configurar shadcn/ui sobre Base UI, Tailwind e `lucide-react`. Emojis não são usados como ícones de interface.
- Implementar o tema dark “palco futurista”: grafite/preto, violeta primário, ciano de realce, sans geométrica e display condensada apenas em títulos de palco.
- Definir em `src/shared` os tipos de domínio, schemas de runtime, envelope WebSocket e códigos de erro comuns, ainda sem transporte ativo.
- Disponibilizar comandos para verificação de tipos, unitários, integração e E2E.

## Fora de escopo

Servidor LAN, QR, perfil, fila, persistência de sessão, player e voto.

## Aceite

- Aplicativo abre em Windows e renderer mostra a tela host em estado `ready`.
- Typecheck, lint, build e testes vazios/seed executam sem falha.
- Controles-base apresentam foco visível, contraste suficiente e redução de movimento.
- Um teste prova que um payload inválido não passa pelo schema compartilhado.
