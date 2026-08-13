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

  // MUI Select sem nome acessível (InputLabel sem htmlFor/id): localiza o
  // FormControl pelo texto do label e opera o combobox dentro dele.
  const muiSelect = page
    .locator(".MuiFormControl-root")
    .filter({ has: page.locator("label", { hasText: label }) })
    .getByRole("combobox")
    .first();
  if (await muiSelect.count() > 0) {
    await muiSelect.click();
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

test("Ficha de Matrícula: criação com aluno novo, validação e listagem", async ({ page, request }) => {
  const shiftName = unique("Turno matrícula"), className = unique("Turma matrícula");
  const shift = await apiCreate(request, "shifts", { name: shiftName });
  await apiCreate(request, "classes", { name: className, school_year: 2026, shift_id: shift.id });
  const original = unique("Matrícula E2E");
  await loginUi(page); await openMenu(page, "Ficha de Matrícula", "Cadastros");

  // O formulário inicia fechado; expande ao clicar em "+ Novo Registro".
  await page.getByRole("button", { name: "+ Novo Registro" }).click();

  // Obrigatórios: salvar em branco mostra mensagens amigáveis.
  await page.getByRole("button", { name: "Salvar Matrícula" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Informe o nome do aluno" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Informe o ano da matrícula" })).toBeVisible();

  // Aluno novo digitado no autocomplete.
  await page.locator("input[placeholder='Buscar aluno ou digitar nome para novo...']").fill(original);

  // Dados da matrícula (campos <label><span>…</span><input|select/></label> sem aria-label).
  await page.locator("label").filter({ hasText: "Ano" }).locator("input").first().fill("2026");
  await page.locator("label").filter({ hasText: "Turma requerida" }).locator("select").first().selectOption({ label: className });
  await page.locator("label").filter({ hasText: "Turno requerido" }).locator("select").first().selectOption({ label: shiftName });

  await page.getByRole("button", { name: "Salvar Matrícula" }).click();

  // Sucesso: sem alerta de erro e o aluno aparece no grid de matrículas.
  await expect(page.getByRole("alert").filter({ hasText: "Falha" })).toHaveCount(0, { timeout: 10_000 });
  const grid = page.locator("section", { hasText: "Matrículas existentes" });
  await expect(grid.getByText(original).first()).toBeVisible({ timeout: 10_000 });
  await expect(grid.getByText(className).first()).toBeVisible();
  await expect(grid.getByText(shiftName).first()).toBeVisible();
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

  // A grid exibe apenas a coluna "Nome do aluno" (demais campos ficam ocultos),
  // então filtro/edição/exclusão operam pelo nome do aluno.
  await filterRecord(page, studentName);
  const row = page.getByRole("row").filter({ hasText: studentName });
  await row.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Editar registro" })).toBeVisible();
  const field = page.getByRole("textbox", { name: "Contato de emergência", exact: true });
  await expect(field).toHaveValue(original);
  await field.fill(changed);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Registro atualizado com sucesso.")).toBeVisible();

  await row.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("heading", { name: "Excluir registro" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).last().click();
  await expect(page.getByText("Registro excluído com sucesso.")).toBeVisible();
  await page.getByPlaceholder("Filtrar registros...").fill(studentName);
  await expect(page.getByText("Nenhum registro encontrado.")).toBeVisible();
});
