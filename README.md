# Sistema Recrescer

Modernização do sistema legado de gestão escolar, com React 19, `@alexandretorqueti/biblioteca-global-ui` (^0.1.19), API Node.js e MySQL 8.4.

Arquitetura e deploy estão documentados em `docs/ARCHITECTURE.md` e `docs/DEPLOYMENT.md`.

## Execução com Docker

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: `http://localhost:6174` (porta 5173 dentro do container)
- API: `http://localhost:3002/api/health` (porta 3001 dentro do container)
- Banco MySQL 8.4 persistente: volume Docker `recrescer_mysql` (container `mysql`, porta 3307 no host)

No primeiro start a API cria o usuário definido em `ADMIN_LOGIN`/`ADMIN_PASSWORD`. Rodando a API fora do Docker (`npm run api`) sem as variáveis, os valores padrão são `admin` / `recrescer`; no `compose.yaml` o padrão da senha é `1234`.

## Estrutura

- `src/`: aplicação React, navegação, data sources e telas.
- `server/index.mjs`: API, autenticação e CRUDs.
- `server/schema.sql`: tabelas, índices e views de relatórios.
- `compose.yaml`: frontend, API e MySQL.
- `docs/`: arquitetura e deploy (fontes atuais).
- `deploy/`: scripts e infraestrutura (SAM) de produção; `deploy/config.env` contém credenciais e nunca deve ser versionado.

## Funcionalidades

- autenticação exclusivamente por login e senha;
- usuários administrativos com senha derivada via `scrypt`;
- CRUD de ficha de matrícula, alunos, pais, mães e ficha médica;
- CRUD de turmas e turnos;
- CRUD de usuários administrativos;
- relatórios de ficha de matrícula, ficha médica, lista de presença e alunos por turma;
- impressão dos relatórios pelo navegador.

## Views de relatório

- `vw_enrollment_forms`
- `vw_medical_forms`
- `vw_attendance_list`
- `vw_students_by_class`

As operações de transporte ficam na aplicação (`src/api.ts`). A Biblioteca Global permanece desacoplada do backend e recebe operações por callbacks/data sources.

## Testes funcionais

A suíte Playwright cobre autenticação, inclusão, pesquisa, abertura/edição, alteração, exclusão e validação dos campos obrigatórios dos cadastros, além das quatro views de relatórios.

```bash
docker compose --profile test run --rm tests
```

O container de testes usa a imagem oficial do Playwright com Chromium. Durante a suíte, API e Vite são iniciados isoladamente em `3101` e `5175`; os testes usam o banco MySQL `recrescer_test` no container `mysql`.
