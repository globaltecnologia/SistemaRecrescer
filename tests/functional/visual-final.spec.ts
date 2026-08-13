import { test } from "@playwright/test";
import { loginUi, openMenu } from "./helpers";

test("visual dark: conferência dos ajustes finais", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginUi(page);
  await page.screenshot({ path: "test-results/final-01-dashboard.png", fullPage: true });

  await openMenu(page, "Alunos", "Cadastros");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/final-02-alunos-grid.png", fullPage: false });

  await page.getByRole("button", { name: "Novo registro" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/final-03-alunos-form.png", fullPage: false });
});
