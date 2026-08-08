## Como Contribuir

### 1. Ambiente Local
- Certifique-se de que o Docker Compose está funcionando:
  ```bash
  docker compose up --build
  ```
- Frontend: `http://localhost:5173`
- API: `http://localhost:3001/api/health`

### 2. Fluxo de Trabalho Típico

#### A) Adicionar uma Nova Entidade
1. **Backend:** `server/schema.sql` — adicione tabelas e views.
2. **Servidor Node (src/api.ts):** — defina sources, rotas CRUD.
3. **Frontend (src/catalog.ts):** — exporte definições para a UI (`entities`, `reports`).
4. **Componentes React:** crie elementos de interface do usuário onde necessário (geralmente gerenciados pela biblioteca global @alexandretorqueti/biblioteca-global-ui).

#### B) Executando Testes Funcionais
```bash
docker compose --profile test run --rm tests
```
Os testes funcionais são executados em um container Playwright separado; eles iniciam a API e o Vite localmente para validação de integração.

### 3. Diretrizes de Código
- TypeScript + ESLint (`oxlint`) ativos por padrão.
- Sem console.log em branches que vão para produção (remova ou envie para logger adequado).
- Use `npm run lint:fix` para correções automáticas.

### 4. Revisão e Merge
- Utilize revisões Pull Request (se tiver GitHub Actions/equivalent) ou solicite revisão manual por meio do sistema de mensagens interno.
- Confirme que todos os testes funcionais passam antes de mesclar.

### 5. Gerenciamento de Projetos
Acompanhe tarefas ativamente no projeto “Tarefas” (backend: tarefas-server, frontend: tarefas-web) se quiser rastrear epic stories adicionais.