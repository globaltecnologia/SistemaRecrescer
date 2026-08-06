import { test } from "@playwright/test";
import { createRecord, deleteFilteredRecord, editFilteredRecord, expectRequired, filterRecord, loginUi, openMenu, unique } from "./helpers";

for (const entity of [
  { menu: "Turnos", field: "Nome do turno", required: "Nome do turno é obrigatório.", prefix: "Turno E2E" },
  { menu: "Pais", field: "Nome", required: "Nome é obrigatório.", prefix: "Pai E2E" },
  { menu: "Mães", field: "Nome", required: "Nome é obrigatório.", prefix: "Mãe E2E" },
]) {
  test(`${entity.menu}: incluir, pesquisar, abrir, alterar, excluir e validar obrigatório`, async ({ page }) => {
    const original = unique(entity.prefix), changed = `${original}-alterado`;
    await loginUi(page); await openMenu(page, entity.menu);
    await expectRequired(page, entity.field, entity.required);
    await createRecord(page, { [entity.field]: original });
    await filterRecord(page, original);
    await editFilteredRecord(page, entity.field, original, changed);
    await deleteFilteredRecord(page, changed);
  });
}
