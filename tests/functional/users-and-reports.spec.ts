import { expect, test } from "@playwright/test";
import { apiCreate, loginUi, openMenu, unique } from "./helpers";

test("Usuários: incluir, pesquisar, abrir, alterar, excluir e validar obrigatórios", async ({ page }) => {
  const login = unique("user").toLowerCase(), changed = `${login}-alt`;
  await loginUi(page); await openMenu(page, "Usuários Administrativos");
  await page.getByRole("button", { name: "Novo usuário" }).click();
  await expect(page.getByLabel("Nome")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Login")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Senha")).toHaveAttribute("required", "");
  await page.getByLabel("Nome").fill("Usuário E2E"); await page.getByLabel("Login").fill(login); await page.getByLabel("Senha").fill("SenhaE2E123!");
  await page.getByRole("button", { name: "Salvar" }).click();
  const filter = page.getByPlaceholder("Filtrar registros..."); await filter.fill(login);
  let row = page.getByRole("row").filter({ hasText: login }); await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Editar" }).click(); await expect(page.getByLabel("Login")).toHaveValue(login);
  await page.getByLabel("Login").fill(changed); await page.getByRole("button", { name: "Salvar" }).click();
  await filter.fill(changed); row = page.getByRole("row").filter({ hasText: changed }); await expect(row).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept()); await row.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("row").filter({ hasText: changed })).toHaveCount(0);
});

test("Relatórios: as quatro views carregam dados reais", async ({ page, request }) => {
  const shiftName = unique("Turno relatório"), className = unique("Turma relatório"), studentName = unique("Aluno relatório");
  const shift = await apiCreate(request, "shifts", { name: shiftName });
  const cls = await apiCreate(request, "classes", { name: className, school_year: 2026, shift_id: shift.id, grade: "1º" });
  const student = await apiCreate(request, "students", { registration: unique("REL"), name: studentName, class_id: cls.id, shift_id: shift.id, active: true });
  await apiCreate(request, "enrollments", { year: 2026, student_id: student.id, student_name: studentName, requested_class_id: cls.id, requested_shift_id: shift.id });
  await apiCreate(request, "medical_records", { student_id: student.id, emergency_contact_name: "Contato relatório" });
  await loginUi(page);
  const reportNav = page.locator(".nav-section").filter({ hasText: "Relatórios" });
  for (const report of ["Ficha de Matrícula", "Ficha Médica", "Lista de Presença", "Alunos por Turma"]) {
    await reportNav.getByRole("button", { name: report, exact: true }).click();
    await expect(page.getByText(studentName).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
  }
});
