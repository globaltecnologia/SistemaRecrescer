# Sistema Recrescer — Arquitetura

## Visão Geral
Um sistema de gestão escolar monolítico, composto por:
- **Frontend React 19 (TypeScript)** via Vite — UI principal e relatórios.
- **Backend Node ESM** com Express e SQLite — CRUD, autenticação (`scrypt`) e views para relatórios.
- **Biblioteca Global @alexandretorqueti/biblioteca-global-ui** — componentes de interface reutilizáveis, provedores de tema e utilitários de API.

## Camadas Principais

### 1. Frontend (src/)
- `App.tsx` – Componente raiz com navegação baseada em rotas (`entities`, `reports`, `users`, painel).
- `catalog.ts` — mapeia chaves de página para definições de entidade/relatório.
- `api.ts` — cliente HTTP que consome endpoints REST do backend.
- Componentes por entidade (ex: `/src/features/enrollments/...`) após extração.

### 2. Backend (server/)
- `index.mjs` – entry point do Express.
- `schema.sql` — definições de tabelas, índices e views para relatórios.
- `api.ts` — implementação de rotas (`/src/server/api/`), data sources (ex: `EnrollmentSource`), middlewares de autenticação/token, roteamento de usuários.

### 3. Biblioteca Global (@alexandretorqueti/biblioteca-global-ui)
Separada, importada como dependência — fornece:
- Componentes prontos para uso (`AuthPanel`, `Cadastro`, etc.).
- Provedor de tema.
- Utilitários auxiliares (ex: `createDataSource`).

## Fluxo de Dados Típico
1. **Login** → `/api/login` (backend) → JWT/token armazenado via cookies/HTTP-only.
2. **CRUD** – Frontend chama endpoints (`/enrollments`, etc.) -> middleware verifica token, invoca data sources que executam SQL no SQLite (`server/db.sqlite`).
3. **Relatórios** – Consulta das views (`vw_enrollment_forms`, etc.) diretamente via `listReport`. Dados formatados pelo frontend (ex: formatação de data/hora para impressão).
4. **Impressão** – PDF/HTML baseado em navegador da tela do relatório.

## Configurações e Ferramentas
- **Docker Compose** — composição da aplicação (`frontend`, `api`, `tests`).
- **Playwright** — testes funcionais executados como perfil separado; eles iniciam a API (3101) + Vite (5175) localmente para isolar o ambiente de teste.
- **Linting/Formatting** via `oxlint` + pré-configurações personalizadas do editor (via .editorconfig, .prettierc).

## Organização Futuro Esperada
Após aplicação da refatoração sugerida:
- **src/features/** por domínio de negócio.
- **server/router/** → rotas específicas por entidade; **server/middleware/** para autenticação e validação.
- **src/lib/apiClient/** centraliza clientes HTTP.

## Próximos Passos para Manutenibilidade
- Adicionar `docs/CONTRIBUTING.md` (criado).
- Garantir .gitignore para artefatos de build (`dist/`, `node_modules/`).
- Pipeline CI com verificação de type-check e linting automático.
- Lembrete semanal via QQBot para revisões de manutenção.