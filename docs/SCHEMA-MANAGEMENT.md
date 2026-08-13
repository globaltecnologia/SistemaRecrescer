# Schema Management — Sistema Recrescer

## Visão Geral

Cada deploy da API **resetá o banco de dados inteiro** a partir do arquivo `server/schema.sql`. Isso garante consistência total entre o código e o banco. Durante a fase de homologação, isso significa: **perder todos os dados cadastrados nos testes**.

Para produção futura, ver seção **"Evolução para Migrations"** abaixo.

## Como Funciona Hoje

### Deploy Atual (Homologação)

Ao iniciar, a API executa `initializeDatabase()`:

1. Desabilita chaves estrangeiras (`FOREIGN_KEY_CHECKS = 0`)
2. Dropa **todas** as views (5 views)
3. Dropa **todas** as tabelas em ordem de dependência:
   - medical_records → enrollments → students → fathers → mothers → classes → shifts → sessions → users
4. Reabilita chaves estrangeiras
5. Executa todo o `server/schema.sql` (CREATE TABLE + CREATE VIEW)
6. O `ensureAdmin()` cria o usuário admin se não existir

**Resultado:** banco sempre limpo, com o schema exato do repositório + admin usuário.

### Arquivos Chave

- `server/schema.sql` — fonte da verdade do schema (tabelas + views)
- `server/index.mjs` → `initializeDatabase()` e `ensureAdmin()` — aplica o schema no startup
- `deploy/migrations/001-remove-enrollments-redundant-columns.sql` — migration pendente (não executada ainda)

## Processo de Deploy com Mudança de Schema

Quando houver alteração no banco:

### Passo 1 — Atualizar `server/schema.sql`
Fazer **todas** as mudanças de schema diretamente no arquivo `.sql`. Este é o documento único.

### Passo 2 — Verificar Consistência
Antes de deploy, garantir que:
- [ ] O código backend (`server/index.mjs`) referencia apenas colunas existentes no schema
- [ ] O catálogo frontend (`src/catalog.ts`) usa os campos corretos
- [ ] As views (vw_*) são consistentes com as tabelas

### Passo 3 — Deploy da API
```bash
cd ~/SistemaRecrescerGlobal
./deploy/aws-deploy.sh all
```

O banco será resetado automaticamente no startup da Lambda.

### Passo 4 — Validação
- [ ] Acessar o sistema e verificar login admin
- [ ] Verificar listagens principais (alunos, turmas, etc.)
- [ ] Testar fluxo crítico (ex: matrícula de aluno novo)

## Evolução para Migrations (Produção Futura)

Quando sair da fase de homologação, o schema management deve evoluir:

### Fase 1 — Adicionar Script de Backup (Agora)
```bash
# Antes de qualquer deploy que altere schema:
mysqldump --single-transaction --routines --triggers \
  -h "$MYSQL_HOST" -P 3306 -u "recrescer_app" -p"$MYSQL_PASSWORD" \
  recrescer > backups/schema-$(date +%Y%m%d-%H%M%S).sql
```

### Fase 2 — Migration System (Quando Houver Dados Reais)
Substituir o `initializeDatabase()` que faz DROP+CREATE por:
1. **`schema.sql`** → fonte do schema final esperado (sem DROP/CREATE IF NOT EXISTS)
2. **Migrations em `deploy/migrations/*.sql`** → script incrementais que transformam o DB atual no schema alvo
3. **`initializeDatabase()`** → verificar versão atual vs target e aplicar migrations pendentes

Exemplo de sistema:
```sql
-- migrate-001-remove-enrollments-redundant-columns.sql (já existe)
ALTER TABLE enrollments DROP COLUMN student_name, ...;
```

Com controle de qual migration já foi aplicada (tabela `schema_migrations` ou similar).

### Fase 3 — Branch de Migrations
- Manter migrations em branch separado até homologação concluída
- Merge para main apenas quando a creche aprovar o estado final do banco

## Notas Importantes

1. **Nunca versionar credenciais** — `deploy/config.env` é `.gitignore` + modo 0600
2. **Schema.sql deve sempre ser idempotente** — mesmo com DROP+CREATE, views usam `DROP VIEW IF EXISTS`
3. **Admin user sobrevive ao reset** — o `ensureAdmin()` cria se não existir, mas se já existe mantém
4. **SSL obrigatório em produção** — Aiven exige TLS. Configuração via env vars (`MYSQL_SSL_MODE`, `MYSQL_SSL_CA_BASE64`)

## Troubleshooting

### "Table doesn't exist" após deploy
- Verificar se a Lambda foi realmente rebuild (build.sh → build da imagem Docker)
- Checar logs CloudWatch: `initializeDatabase()` deve aparecer como sucesso no startup

### View referenciando coluna removida
- Isso é o que nos trouxe aqui. Antes de alterar schema, verificar todos os pontos que usam as views:
  ```bash
  grep -rn "vw_enrollments\|vw_enrollment_forms" src/ server/
  ```

### Erro de foreign key durante deploy
- `FOREIGN_KEY_CHECKS = 0` é aplicado em `initializeDatabase()`, então não deve acontecer
- Se aparecer, verificar se há código executando queries durante o startup antes do schema ser aplicado
