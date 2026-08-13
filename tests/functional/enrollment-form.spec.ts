import { expect, test, type Page } from "@playwright/test";
import { apiCreate, loginUi, openMenu, unique } from "./helpers";

// Formulário refatorado da Ficha de Matrícula (EnrollmentsPage).
// Os campos são <label><span>Rótulo</span><input|select/></label> sem aria-label/name,
// então localizamos o label pelo texto e descemos para o controle.

function field(page: Page, label: string) {
  return page.locator("label").filter({ hasText: label }).locator("input, select").first();
}

async function fillField(page: Page, label: string, value: string) {
  const el = field(page, label);
  const tag = await el.evaluate((n) => n.tagName);
  if (tag === "SELECT") {
    await el.selectOption({ label: value });
  } else if ((await el.getAttribute("type")) === "number") {
    await el.fill(value);
  } else {
    await el.fill(value);
  }
}

async function selectOption(page: Page, label: string, option: string) {
  const el = field(page, label);
  await el.selectOption({ label: option });
}

// Preenche o autocomplete de aluno com um nome (novo ou para busca) e,
// se houver sugestão exata, clica nela.
async function typeStudent(page: Page, name: string, pickExact = false) {
  const input = page.locator("input[placeholder='Buscar aluno ou digitar nome para novo...']");
  await input.fill(name);
  if (pickExact) {
    // Clica no item de sugestão (div clicável que contém <strong>nome</strong>)
    // dentro do dropdown do aluno.
    const strong = page.locator("strong", { hasText: name }).first();
    await strong.click();
  }
}

// Abre a Ficha de Matrícula e expande o formulário de inclusão
// (o form agora inicia fechado; só aparece ao apertar "+ Novo Registro").
async function openEnrollmentForm(page: Page) {
  await openMenu(page, "Ficha de Matrícula", "Cadastros");
  await page.getByRole("button", { name: "+ Novo Registro" }).click();
}

test.describe("Inclusão de matrícula (formulário refatorado)", () => {
  test("cria aluno novo, pai, mãe e matrícula num único envio", async ({ page, request }) => {
    const shiftName = unique("Turno form");
    const className = unique("Turma form");
    const shift = await apiCreate(request, "shifts", { name: shiftName });
    await apiCreate(request, "classes", { name: className, school_year: 2026, shift_id: shift.id });

    const studentName = unique("Criança Nova");
    const fatherName = unique("Pai Novo");
    const motherName = unique("Mãe Nova");

    await loginUi(page);
    await openEnrollmentForm(page);

    // Aluno novo digitado (sem seleção) — aciona fluxo de criação.
    await typeStudent(page, studentName);
    await expect(page.getByText("Nenhum aluno encontrado — preencha os dados abaixo para criar um novo.")).toBeVisible();

    // Pai novo digitado.
    const fatherInput = page.locator("fieldset", { hasText: "Pai" }).locator("input[placeholder='Buscar ou digitar novo...']");
    await fatherInput.fill(fatherName);
    const fatherCpf = page.locator("fieldset", { hasText: "Pai" }).locator("label", { hasText: "CPF" }).locator("input");
    await fatherCpf.fill("111.222.333-44");

    // Mãe nova digitada.
    const motherInput = page.locator("fieldset", { hasText: "Mãe" }).locator("input[placeholder='Buscar ou digitar novo...']");
    await motherInput.fill(motherName);
    const motherCpf = page.locator("fieldset", { hasText: "Mãe" }).locator("label", { hasText: "CPF" }).locator("input");
    await motherCpf.fill("555.666.777-88");

    // Dados da matrícula.
    await field(page, "Ano").fill("2026");
    await selectOption(page, "Turma requerida", className);
    await selectOption(page, "Turno requerido", shiftName);
    await fillField(page, "Carga horária", "4h");

    await page.getByRole("button", { name: "Salvar Matrícula" }).click();

    // Sucesso: sem alerta de erro, e o grid de matrículas passa a exibir o aluno.
    await expect(page.getByRole("alert").filter({ hasText: "Falha" })).toHaveCount(0, { timeout: 10_000 });
    const grid = page.locator("section", { hasText: "Matrículas existentes" });
    await expect(grid.getByText(studentName).first()).toBeVisible({ timeout: 10_000 });

    // O grid de matrículas deve exibir apenas as colunas Ano, Aluno, Turma e Turno.
    const headers = grid.getByRole("columnheader");
    await expect(headers).toHaveText(["Ano", "Aluno", "Turma", "Turno"]);

    // Confirma que pai e mãe foram persistidos via API.
    const token = await (await request.post("http://127.0.0.1:3101/api/auth/login", { data: { login: "admin", password: "recrescer" } })).json() as { token: string };
    const fathers = await (await request.get("http://127.0.0.1:3101/api/fathers", { headers: { Authorization: `Bearer ${token.token}` } })).json() as Array<{ name: string }>;
    const mothers = await (await request.get("http://127.0.0.1:3101/api/mothers", { headers: { Authorization: `Bearer ${token.token}` } })).json() as Array<{ name: string }>;
    expect(fathers.some((f) => f.name === fatherName)).toBeTruthy();
    expect(mothers.some((m) => m.name === motherName)).toBeTruthy();
  });

  test("inclui matrícula para aluno, pai e mãe já existentes via autocomplete", async ({ page, request }) => {
    const shiftName = unique("Turno exist");
    const className = unique("Turma exist");
    const fatherName = unique("Pai Exist");
    const motherName = unique("Mãe Exist");
    const studentName = unique("Criança Exist");

    const shift = await apiCreate(request, "shifts", { name: shiftName });
    await apiCreate(request, "classes", { name: className, school_year: 2026, shift_id: shift.id });
    const father = await apiCreate(request, "fathers", { name: fatherName, cpf: "999.888.777-66" });
    const mother = await apiCreate(request, "mothers", { name: motherName, cpf: "444.555.666-77" });
    await apiCreate(request, "students", {
      registration: unique("REG"),
      name: studentName,
      father_id: father.id,
      mother_id: mother.id,
      active: true,
    });

    await loginUi(page);
    await openEnrollmentForm(page);

    // Seleciona o aluno existente pelo autocomplete.
    await typeStudent(page, studentName, true);
    await expect(page.getByText(studentName).first()).toBeVisible();

    // Pai e mãe devem ser pré-carregados pelo vínculo do aluno.
    await expect(page.locator("fieldset", { hasText: "Pai" }).locator("input[placeholder='Buscar ou digitar novo...']")).toHaveValue(fatherName);
    await expect(page.locator("fieldset", { hasText: "Mãe" }).locator("input[placeholder='Buscar ou digitar novo...']")).toHaveValue(motherName);

    await field(page, "Ano").fill("2027");
    await selectOption(page, "Turma requerida", className);
    await selectOption(page, "Turno requerido", shiftName);

    await page.getByRole("button", { name: "Salvar Matrícula" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Falha" })).toHaveCount(0, { timeout: 10_000 });
    const grid = page.locator("section", { hasText: "Matrículas existentes" });
    await expect(grid.getByText(studentName).first()).toBeVisible({ timeout: 10_000 });
  });

  test("valida campos obrigatórios (nome do aluno e ano) com mensagem amigável", async ({ page }) => {
    await loginUi(page);
    await openEnrollmentForm(page);

    // Nenhum aluno e nenhum ano preenchidos — clicar em Salvar deve mostrar
    // mensagens claras de validação, não o erro cru do MySQL.
    await page.getByRole("button", { name: "Salvar Matrícula" }).click();

    // Nome do aluno obrigatório para aluno novo.
    await expect(page.getByRole("alert").filter({ hasText: "Informe o nome do aluno" })).toBeVisible();
    // Ano obrigatório.
    await expect(page.getByRole("alert").filter({ hasText: "Informe o ano da matrícula" })).toBeVisible();
  });

  test("cancelar fecha o formulário sem salvar", async ({ page }) => {
    await loginUi(page);
    await openEnrollmentForm(page);

    // Abre o form e preenche algo; ao cancelar, o form deve fechar sem persistir.
    await typeStudent(page, unique("Cancelada"));
    await expect(page.getByRole("button", { name: "Salvar Matrícula" })).toBeVisible();

    await page.getByRole("button", { name: "Cancelar" }).click();

    // Form escondido (sem Salvar Matrícula) e botão de novo registro de volta.
    await expect(page.getByRole("button", { name: "Salvar Matrícula" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Novo Registro" })).toBeVisible();
  });
});
