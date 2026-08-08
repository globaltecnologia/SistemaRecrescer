# Sistema Recrescer — Visão Geral

## Arquitetura
- **Frontend:** `src/` (React 19 + TypeScript + Vite)
- **Backend:** `server/index.mjs` (Node ESM)
- **Biblioteca Global:** `@alexandretorqueti/biblioteca-global-ui`

## Fluxo de Dados Principal
1. Login/cadastro → API (`/api.ts`)
2. CRUDs por entidade via sources globais e views de relatórios

## Como Executar Localmente
```bash
cp .env.example .env
docker compose up --build   # frontend em localhost:5173, API em localhost:3001
```

## Scripts Úteis
- `npm run dev` – Vite dev
- `npm run api` – execução da API Node (em segundo plano)
- `npm test:functional` – suíte Playwright