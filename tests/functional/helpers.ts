import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const admin = { login: "admin", password: "recrescer" };

export function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loginUi(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Login", exact: true }).fill(admin.login);
  await page.getByRole("textbox", { name: "Senha", exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Administrador · admin")).toBeVisible();
}

export async function apiLogin(request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:3101/api/auth/login", { data: admin });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token as string;
}

export async function apiCreate(request: APIRequestContext, resource: string, data: Record<string, unknown>) {
  const token = await apiLogin(request);
  const response = await request.post(`http://127.0.0.1:3101/api/${resource}`, {
    headers: { Authorization: `Bearer ${token}` }, data,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<Record<string, unknown>>;
}

export async function openMenu(page: Page, name: string, section?: string) {
  const root = section ? page.locator(".nav-section").filter({ hasText: section }) : page;
  const button = root.getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toHaveClass(/active/);
}

export async function createRecord(page: Page, values: Record<string, string | number>) {
  await page.getByRole("button", { name: "Novo registro" }).click();
  for (const [label, value] of Object.entries(values)) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(String(value));
  }
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Registro cadastrado com sucesso.")).toBeVisible();
}

export async function filterRecord(page: Page, value: string) {
  await page.getByPlaceholder("Filtrar registros...").fill(value);
  await expect(page.getByRole("cell", { name: value, exact: true }).first()).toBeVisible();
}

export async function editFilteredRecord(page: Page, fieldLabel: string, oldValue: string, newValue: string) {
  const row = page.getByRole("row").filter({ hasText: oldValue });
  await row.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Editar registro" })).toBeVisible();
  const field = page.getByRole("textbox", { name: fieldLabel, exact: true });
  await expect(field).toHaveValue(oldValue);
  await field.fill(newValue);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Registro atualizado com sucesso.")).toBeVisible();
  await page.getByPlaceholder("Filtrar registros...").fill(newValue);
  await expect(page.getByRole("cell", { name: newValue, exact: true }).first()).toBeVisible();
}

export async function deleteFilteredRecord(page: Page, value: string) {
  const row = page.getByRole("row").filter({ hasText: value });
  await row.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("heading", { name: "Excluir registro" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).last().click();
  await expect(page.getByText("Registro excluído com sucesso.")).toBeVisible();
  await page.getByPlaceholder("Filtrar registros...").fill(value);
  await expect(page.getByText("Nenhum registro encontrado.")).toBeVisible();
}

export async function expectRequired(page: Page, fieldLabel: string, errorText: string) {
  await page.getByRole("button", { name: "Novo registro" }).click();
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Revise os campos destacados antes de continuar.")).toBeVisible();
  await expect(page.getByText(errorText)).toBeVisible();
  await expect(page.getByRole("textbox", { name: fieldLabel, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
}
