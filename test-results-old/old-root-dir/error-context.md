# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Autenticação >> entra, restaura a sessão e sai
- Location: tests/functional/auth.spec.ts:15:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: 'Login', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]: "Blocked request. This host (\"sistemarecrescerglobal-web-1\") is not allowed. To allow this host, add \"sistemarecrescerglobal-web-1\" to `server.allowedHosts` in vite.config.js."
```

# Test source

```ts
  1  | import { expect, type APIRequestContext, type Page } from "@playwright/test";
  2  | 
  3  | export const admin = { login: "admin", password: "recrescer" };
  4  | 
  5  | export function unique(prefix: string) {
  6  |   return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  7  | }
  8  | 
  9  | export async function loginUi(page: Page) {
  10 |   await page.goto("http://sistemarecrescerglobal-web-1:5173/");
> 11 |   await page.getByRole("textbox", { name: "Login", exact: true }).fill(admin.login);
     |                                                                   ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  12 |   await page.getByRole("textbox", { name: "Senha", exact: true }).fill(admin.password);
  13 |   await page.getByRole("button", { name: "Entrar", exact: true }).click();
  14 |   await expect(page.getByText("Administrador · admin")).toBeVisible();
  15 | }
  16 | 
  17 | export async function apiLogin(request: APIRequestContext) {
  18 |   const response = await request.post("http://sistemarecrescerglobal-api-1:3001/api/auth/login", { data: admin });
  19 |   expect(response.ok()).toBeTruthy();
  20 |   return (await response.json()).token as string;
  21 | }
  22 | 
  23 | export async function apiCreate(request: APIRequestContext, resource: string, data: Record<string, unknown>) {
  24 |   const token = await apiLogin(request);
  25 |   const response = await request.post(`http://sistemarecrescerglobal-api-1:3001/api/${resource}`, {
  26 |     headers: { Authorization: `Bearer ${token}` }, data,
  27 |   });
  28 |   expect(response.ok(), await response.text()).toBeTruthy();
  29 |   return response.json() as Promise<Record<string, unknown>>;
  30 | }
  31 | 
  32 | export async function openMenu(page: Page, name: string, section?: string) {
  33 |   const root = section ? page.locator(".nav-section").filter({ hasText: section }) : page;
  34 |   const button = root.getByRole("button", { name, exact: true });
  35 |   await button.click();
  36 |   await expect(button).toHaveClass(/active/);
  37 | }
  38 | 
  39 | export async function createRecord(page: Page, values: Record<string, string | number>) {
  40 |   await page.getByRole("button", { name: "Novo registro" }).click();
  41 |   for (const [label, value] of Object.entries(values)) {
  42 |     await page.getByRole("textbox", { name: label, exact: true }).fill(String(value));
  43 |   }
  44 |   await page.getByRole("button", { name: "Cadastrar" }).click();
  45 |   await expect(page.getByText("Registro cadastrado com sucesso.")).toBeVisible();
  46 | }
  47 | 
  48 | export async function filterRecord(page: Page, value: string) {
  49 |   await page.getByPlaceholder("Filtrar registros...").fill(value);
  50 |   await expect(page.getByRole("cell", { name: value, exact: true }).first()).toBeVisible();
  51 | }
  52 | 
  53 | export async function editFilteredRecord(page: Page, fieldLabel: string, oldValue: string, newValue: string) {
  54 |   const row = page.getByRole("row").filter({ hasText: oldValue });
  55 |   await row.getByRole("button", { name: "Editar" }).click();
  56 |   await expect(page.getByRole("heading", { name: "Editar registro" })).toBeVisible();
  57 |   const field = page.getByRole("textbox", { name: fieldLabel, exact: true });
  58 |   await expect(field).toHaveValue(oldValue);
  59 |   await field.fill(newValue);
  60 |   await page.getByRole("button", { name: "Salvar alterações" }).click();
  61 |   await expect(page.getByText("Registro atualizado com sucesso.")).toBeVisible();
  62 |   await page.getByPlaceholder("Filtrar registros...").fill(newValue);
  63 |   await expect(page.getByRole("cell", { name: newValue, exact: true }).first()).toBeVisible();
  64 | }
  65 | 
  66 | export async function deleteFilteredRecord(page: Page, value: string) {
  67 |   const row = page.getByRole("row").filter({ hasText: value });
  68 |   await row.getByRole("button", { name: "Excluir" }).click();
  69 |   await expect(page.getByRole("heading", { name: "Excluir registro" })).toBeVisible();
  70 |   await page.getByRole("button", { name: "Excluir", exact: true }).last().click();
  71 |   await expect(page.getByText("Registro excluído com sucesso.")).toBeVisible();
  72 |   await page.getByPlaceholder("Filtrar registros...").fill(value);
  73 |   await expect(page.getByText("Nenhum registro encontrado.")).toBeVisible();
  74 | }
  75 | 
  76 | export async function expectRequired(page: Page, fieldLabel: string, errorText: string) {
  77 |   await page.getByRole("button", { name: "Novo registro" }).click();
  78 |   await page.getByRole("button", { name: "Cadastrar" }).click();
  79 |   await expect(page.getByText("Revise os campos destacados antes de continuar.")).toBeVisible();
  80 |   await expect(page.getByText(errorText)).toBeVisible();
  81 |   await expect(page.getByRole("textbox", { name: fieldLabel, exact: true })).toBeVisible();
  82 |   await page.getByRole("button", { name: "Cancelar" }).click();
  83 | }
  84 | 
```