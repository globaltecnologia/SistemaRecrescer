# Refatoração da Ficha de Matrícula

## Resumo

A ficha de matrícula foi completamente reescrita como um formulário customizado (`EnrollmentsPage`), substituindo o `Cadastro` genérico da Biblioteca Global. O usuário pode agora:

- **Selecionar aluno existente** → todos os dados são preenchidos automaticamente (nome, nascimento, endereço, sexo, nacionalidade)
- **Criar aluno novo** → digita o nome no autocomplete e preenche os campos manualmente
- **Gerenciar pais/mães** diretamente pelo formulário da matrícula, com busca por nome/CPF

## Mudanças realizadas

### Backend (`server/index.mjs`)
- Novo endpoint `POST /api/enrollments/complete` que recebe JSON estruturado com `student`, `father`, `mother`, `enrollment` e persiste tudo com transação atômica (CREATE/UPDATE em todas as tabelas)

### Frontend API (`src/api.ts`)
- Novos tipos: `EnrollmentPayload`, `EnrollmentResult`
- Nova função: `createCompleteEnrollment(payload)`

### Frontend UI (`src/App.tsx`)
- Novo componente `EnrollmentsPage` com:
  - `StudentAutocomplete` — busca alunos, seleciona existente ou permite digitar novo
  - `FatherSection` — busca pai existente ou cria novo, com campos editáveis
  - `MotherSection` — mesma lógica para mãe
  - Auto-preenchimento ao selecionar aluno existente
  - Reseta dados derivativos ao deselecionar aluno
- Novos componentes auxiliares: `findFatherById`, `findMotherById`
- Grid de matrículas existentes (`EnrollmentGrid`)

### Catálogo (`src/catalog.ts`)
- Fields da `enrollments` marcados como placeholder (lógica movida pro App.tsx)

## Pendentes para a próxima fase
- Remover colunas redundantes da tabela `enrollments` no schema SQL
- Atualizar views e API routes genéricos para refletir schema limpo
- Adicionar teste funcional Playwright para a nova ficha
