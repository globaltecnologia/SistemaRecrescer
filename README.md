# Sistema Recrescer

Modernização inicial do sistema legado de gestão escolar, com React 19 e `@alexandretorqueti/biblioteca-global-ui` 0.1.9.

## Execução com Docker

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001/api/health`
- Banco SQLite persistente: volume Docker `recrescer_data`

No primeiro start a API cria o usuário definido em `ADMIN_LOGIN`/`ADMIN_PASSWORD`. Se as variáveis não forem definidas, somente para desenvolvimento, os valores padrão são `admin` / `recrescer`.

## Estrutura

- `src/`: aplicação React, navegação, data sources e telas.
- `server/index.mjs`: API, autenticação e CRUDs.
- `server/schema.sql`: tabelas, índices e views de relatórios.
- `compose.yaml`: frontend e API.

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
