# Sistema Recrescer — Arquitetura atual

## Componentes

- Frontend React 19 + TypeScript + Vite.
- API Node.js 22 usando `node:http`, empacotada como imagem Docker.
- Banco MySQL 8.4 gerenciado pela Aiven, com TLS obrigatório.
- Produção:
  - frontend no Cloudflare Pages;
  - API no AWS Lambda via Lambda Web Adapter e Function URL;
  - imagem da API no Amazon ECR;
  - infraestrutura AWS declarada em SAM/CloudFormation.

## Fluxo de produção

```text
Navegador
  -> Cloudflare Pages (React)
  -> AWS Lambda Function URL (/api/*)
  -> Aiven MySQL (TLS)
```

O frontend recebe a URL da API durante o build por `VITE_API_BASE_URL`.
A configuração local continua usando o proxy `/api` do Vite definido em
`vite.config.ts`.

## Arquivos principais

- `src/api.ts`: cliente HTTP e autenticação do frontend.
- `server/index.mjs`: servidor HTTP, rotas, autenticação e acesso ao MySQL.
- `server/schema.sql`: schema inicializado pela API.
- `Dockerfile.lambda`: imagem de produção da API.
- `deploy/template.yaml`: recursos AWS SAM.
- `deploy/`: scripts idempotentes de provisionamento e publicação.

## Segurança e segredos

- `deploy/config.env` contém credenciais e possui permissão `0600`.
- O arquivo está ignorado pelo Git e nunca deve ser versionado.
- `deploy/config.env.example` documenta somente os nomes das variáveis.
- O MySQL usa CA da Aiven e validação TLS (`rejectUnauthorized: true`).
