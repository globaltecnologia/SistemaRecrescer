import { expect, test, type Page } from "@playwright/test";
import { apiCreate, deleteFilteredRecord, editFilteredRecord, filterRecord, loginUi, openMenu, unique } from "./helpers";

async function choose(page: Page, label: string, option: string) {
  // Tenta pelo role + name (funciona se o campo tiver aria-label)
  const combobox = page.getByRole("combobox", { name: label });
  
  if (await combobox.count() > 0) {
    await combobox.click();
    await page.getByRole("option", { name: option }).click();
    return;
  }
  
  // Fallback: tenta encontrar pelo <select> com o name exato
  const select = page.locator("select").filter({ has: page.locator(`option:has-text("${option}")`) });
  if (await select.count() > 0) {
    await select.click();
    await select.selectOption({ label: option });
    return;
  }
  
  // Último recurso: buscar pelo <label> e ir até o <select> pai
  const field = page.getByText(label).first().locator("xpath=..").locator("select");
  if (await field.count() > 0) {
    await field.click();
    await field.selectOption({ label: option });
  }
}

test("Turmas: CRUD, pesquisa e validação", async ({ page, request }) => {
  const shiftName = unique("Turno turma");
  await apiCreate(request, "shifts", { name: shiftName });
  const original = unique("Turma E2E"), changed = `${original}-alterada`;
  await loginUi(page); await openMenu(page, "Turmas");
  await page.getByRole("button", { name: "Novo registro" }).click();
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Nome da turma é obrigatório.")).toBeVisible();
  await page.getByRole("textbox", { name: "Nome da turma", exact: true }).fill(original);
  await page.getByRole("spinbutton", { name: "Ano letivo", exact: true }).fill("2026");
  await choose(page, "Turno", shiftName);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Registro cadastrado com sucesso.")).toBeVisible();
  await filterRecord(page, original);
  await editFilteredRecord(page, "Nome da turma", original, changed);
  await deleteFilteredRecord(page, changed);
});

test("Alunos: CRUD completo com relacionamentos e obrigatórios", async ({ page, request }) => {
  const shiftName = unique("Turno aluno"), className = unique("Turma aluno");
  const fatherName = unique("Pai aluno"), motherName = unique("Mãe aluno");
  const shift = await apiCreate(request, "shifts", { name: shiftName });
  await apiCreate(request, "classes", { name: className, school_year: 2026, shift_id: shift.id });
  await apiCreate(request, "fathers", { name: fatherName });
  await apiCreate(request, "mothers", { name: motherName });
  const registration = unique("MAT"), original = unique("Aluno E2E"), changed = `${original}-alterado`;
  await loginUi(page); await openMenu(page, "Alunos");
  await page.getByRole("button", { name: "Novo registro" }).click();
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Matrícula é obrigatório.")).toBeVisible();
  await expect(page.getByText("Nome é obrigatório.")).toBeVisible();
  await page.getByRole("textbox", { name: "Matrícula", exact: true }).fill(registration);
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill(original);
  await choose(page, "Turma", className); await choose(page, "Turno", shiftName);
  await choose(page, "Pai", fatherName); await choose(page, "Mãe", motherName);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Registro cadastrado com sucesso.")).toBeVisible();
  await filterRecord(page, original);
  await editFilteredRecord(page, "Nome", original, changed);
  await deleteFilteredRecord(page, changed);
});

test("Ficha de Matrícula: CRUD, pesquisa e obrigatórios", async ({ page, request }) => {
  const shiftName = unique("Turno matrícula"), className = unique("Turma matrícula");
  const shift = await apiCreate(request, "shifts", { name: shiftName });
  await apiCreate(request, "classes", { name: className, school_year: 2026, shift_id: shift.id });
  const original = unique("Matrícula E2E"), changed = `${original}-alterada`;
  await loginUi(page); await openMenu(page, "Ficha de Matrícula", "Cadastros");
  await page.getByRole("button", { name: "Novo registro" }).click();
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Ano é obrigatório.")).toBeVisible();
  await expect(page.getByText("Aluno é obrigatório.")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Ano", exact: true }).fill("2026"); await page.getByRole("textbox", { name: "Aluno", exact: true }).fill(original);
  await choose(page, "Turma requerida", className); await choose(page, "Turno requerido", shiftName);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Registro cadastrado com sucesso.")).toBeVisible();
  await filterRecord(page, original);
  await editFilteredRecord(page, "Aluno", original, changed);
  await deleteFilteredRecord(page, changed);
});

test("Ficha Médica: CRUD, pesquisa e aluno obrigatório", async ({ page, request }) => {
  const studentName = unique("Aluno médico"), registration = unique("MED");
  await apiCreate(request, "students", { registration, name: studentName, active: true });
  const original = unique("Contato E2E"), changed = `${original}-alterado`;
  await loginUi(page); await openMenu(page, "Ficha Médica", "Cadastros");
  await page.getByRole("button", { name: "Novo registro" }).click();
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Aluno é obrigatório.")).toBeVisible();
  await choose(page, "Aluno", studentName);
  await page.getByRole("textbox", { name: "Contato de emergência", exact: true }).fill(original);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Registro cadastrado com sucesso.")).toBeVisible();
  await filterRecord(page, original);
  await editFilteredRecord(page, "Contato de emergência", original, changed);
  await deleteFilteredRecord(page, changed);
});
