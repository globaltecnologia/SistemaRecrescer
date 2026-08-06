import { expect, test } from "@playwright/test";
import { admin, loginUi } from "./helpers";

test.describe("Autenticação", () => {
  test("rejeita credenciais inválidas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Login", exact: true }).fill(admin.login);
    await page.getByRole("textbox", { name: "Senha", exact: true }).fill("senha-incorreta");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    // O AuthPanel agora exibe apenas o erro, então filtramos pelo tipo de erro
    const errorAlert = page.getByRole("alert").filter({ hasText: "Login ou senha inválidos." });
    await expect(errorAlert).toBeVisible();
  });

  test("entra, restaura a sessão e sai", async ({ page }) => {
    await loginUi(page);
    await page.reload();
    await expect(page.getByText("Administrador · admin")).toBeVisible();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
  });
});
