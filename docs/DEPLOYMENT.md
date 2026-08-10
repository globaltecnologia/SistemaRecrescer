# Sistema Recrescer — Deploy e continuidade

Atualizado em 2026-08-09.

## Estado atual

- Frontend publicado: <https://sistema-recrescer.pages.dev>
- API publicada: <https://7o7svya2ya536nejerqg34i5du0synak.lambda-url.us-west-2.on.aws/>
- Health check: `/api/health`
- Domínio solicitado: `crecherecrescer.globaltecnologia.net`
- O domínio personalizado ainda precisa ser confirmado no Cloudflare Pages e no DNS.

## Caminhos

- No Bazzite: `/home/alexandre/SistemaRecrescerGlobal`
- No OpenClaw: `/data/workspace/projects/SistemaRecrescerGlobal`
- Scripts: `deploy/`
- Documentação: `docs/`
- Configuração secreta local: `deploy/config.env` (modo `0600`, ignorada pelo Git)

## Infraestrutura criada

### AWS (`us-west-2`, perfil `recrescer`)

- Stack CloudFormation: `sistema-recrescer-prod`
- Lambda: `sistema-recrescer-prod-api`
- Concorrência reservada da Lambda: `10` (configurável por `LAMBDA_RESERVED_CONCURRENCY`).
- Function URL pública com CORS.
- Repositório ECR gerenciado pelo SAM.
- Bucket S3 gerenciado pelo SAM para artefatos.
- Logs no CloudWatch com retenção de 14 dias.

### Aiven

- Projeto: `recrescer`
- Serviço MySQL: `recrescer-mysql`
- Plano: `free-1-1gb`
- Cloud: `do-nyc` (o plano gratuito da conta recusou `aws-us-west-2`)
- Banco: `recrescer`
- Usuário da aplicação: `recrescer_app`
- Termination protection habilitada.
- Existe também `kafka-b7b55c0`; não faz parte deste deploy e não foi alterado.

### Cloudflare Pages

- Projeto: `sistema-recrescer`
- Branch de produção: `main`
- Domínio padrão: `sistema-recrescer.pages.dev`
- O Wrangler foi usado via `npx wrangler@4.120.0`.

## Comandos usuais

No Bazzite:

```bash
cd ~/SistemaRecrescerGlobal

# Ajuda
./deploy/aws-deploy.sh help

# API: validar, construir, publicar e testar
./deploy/aws-deploy.sh all

# Frontend: construir, publicar e testar
./deploy/aws-deploy.sh frontend-all

# Recriar/validar configuração do MySQL Aiven
./deploy/aws-deploy.sh provision-db
```

Se o Wrangler pedir autenticação:

```bash
npx wrangler@4.120.0 login
```

## Primeiro usuário

- Login: `admin`
- A senha está em `ADMIN_PASSWORD` dentro de `deploy/config.env`.
- Para consultá-la localmente sem copiá-la para documentação:

```bash
cd ~/SistemaRecrescerGlobal
source deploy/config.env
printf '%s\n' "$ADMIN_PASSWORD"
```

## DNS do domínio personalizado

No DNS de `globaltecnologia.net`:

```text
Tipo: CNAME
Nome: crecherecrescer
Destino: sistema-recrescer.pages.dev
Proxy Cloudflare: ativado, se a zona estiver na Cloudflare
```

No projeto Cloudflare Pages `sistema-recrescer`, adicionar primeiro o custom
domain `crecherecrescer.globaltecnologia.net` e aguardar a validação/SSL.

## Validações já realizadas

- Build TypeScript/Vite concluído.
- Build da imagem Lambda x86_64 concluído.
- Conexão MySQL com TLS validada usando `mysql2`.
- Stack AWS em `CREATE_COMPLETE`.
- `/api/health` respondeu `{"status":"ok"}`.
- Frontend e bundle publicados e apontando para a Lambda correta.
- Preflight CORS para o domínio Pages aprovado.
- Login administrativo testado com HTTP 200.
- Limite inicial de concorrência `2` causou throttling; ajustado para `10`.

## Observações para a próxima sessão

- Não exibir `deploy/config.env` nem credenciais nos logs.
- Preservar mudanças do usuário já existentes em `compose.yaml` e `docs/`.
- O frontend gera aviso de chunk maior que 500 kB; não impede o funcionamento.
- Antes de continuar, ler este arquivo e executar `git status --short`.
