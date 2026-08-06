import { expect, test } from "@playwright/test";
import { admin, loginUi } from "./helpers";

test.describe("Autenticação", () => {
  test("rejeita credenciais inválidas", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Login").fill(admin.login);
    await page.getByLabel("Senha").fill("senha-incorreta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toContainText("Login ou senha inválidos.");
  });

  test("entra, restaura a sessão e sai", async ({ page }) => {
    await loginUi(page);
    await page.reload();
    await expect(page.getByText("Administrador · admin")).toBeVisible();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
  });
});
