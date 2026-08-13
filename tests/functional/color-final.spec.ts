import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { loginUi, openMenu } from "./helpers";

test("diagnóstico final de cores", async ({ page }) => {
  await loginUi(page);
  await openMenu(page, "Alunos", "Cadastros");
  await page.waitForTimeout(700);

  const grid = await page.evaluate(() => {
    const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : "NOT FOUND");
    return {
      "thead th": bg(document.querySelector("table thead th")),
      "search input root": bg(document.querySelector(".MuiOutlinedInput-root")),
      "paper grid": bg(document.querySelector(".MuiPaper-root")),
      "sidebar": bg(document.querySelector(".sidebar")),
    };
  });

  await page.getByRole("button", { name: "Novo registro" }).click();
  await page.waitForTimeout(600);
  const dialog = await page.evaluate(() => {
    const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : "NOT FOUND");
    return {
      "dialog": bg(document.querySelector('[role="dialog"]')),
      "dialog paper": bg(document.querySelector('[role="dialog"] .MuiPaper-root')),
      "first input root": bg(document.querySelector('[role="dialog"] .MuiOutlinedInput-root')),
      "first select root": bg(document.querySelector('[role="dialog"] .MuiSelect-select')),
    };
  });

  writeFileSync("test-results/color-final.json", JSON.stringify({ grid, dialog }, null, 2));
});
