import fs from "fs";
import mysql from "mysql2/promise";

const LEGADO_SQL = "/tmp/database.sql";
const DB_HOST = "172.30.0.2";
const DB_PASS = "5fb506ee6d2770619e4a7adeef86655d24c8f7ed2a1ea3f65f2d5daf1f2b8dcc";

function cleanValue(raw) {
  raw = raw.trim();
  if (raw.startsWith("N'") && raw.endsWith("'")) return raw.substring(2, raw.length - 1).replace(/''/g, "'");
  if (raw === "bN'0'") return "0";
  if (raw === "bN'1'") return "1";
  if (raw === "NULL") return null;
  const num = parseInt(raw, 10);
  if (!isNaN(num) && String(num) === raw.trim()) return num;
  return raw;
}

function splitByExternalCommas(s) {
  s = s.trim().replace(/^\(+/, "");
  const fields = [];
  let start = 0, inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inString) inString = true;
    else if (ch === "'" && inString) {
      if (i + 1 < s.length && s[i + 1] === "'") { i++; continue; }
      else inString = false;
    }
    else if (ch === "," && !inString) { fields.push(s.substring(start, i).trim()); start = i + 1; }
  }
  const last = s.substring(start).trim().replace(/\)\s*$/, "").trim();
  if (last) fields.push(last);
  return fields;
}

async function run(dryRun) {
  const isDryRun = dryRun === "dry-run";
  console.log("Lendo dump legado...");
  const content = fs.readFileSync(LEGADO_SQL, "utf-8");

  const reqIdx = content.indexOf('INSERT INTO "RE_Requerimento"');
  const afterVals = content.substring(reqIdx).split(/VALUES\s*\n/);
  let dataBlock = afterVals[1] || "";
  const em = dataBlock.search(/ALTER TABLE "RE_Requerimento" ENABLE KEYS/);
  if (em >= 0) dataBlock = dataBlock.substring(0, em);
  const lines = dataBlock.split("\n").filter(l => l.includes("(") && l.includes("N'"));

  const requerimentos = [];
  for (const line of lines) {
    const fields = splitByExternalCommas(line);
    const row = {
      Cod_Requerimento: cleanValue(fields[0]),
      Ano_Requerimento: cleanValue(fields[1]),
      Nome_Aluno: cleanValue(fields[2]),
      Data_Nascimento: cleanValue(fields[3]),
      Nacionalidade: cleanValue(fields[4]),
      Naturalidade: cleanValue(fields[5]),
      SerieAnterior: cleanValue(fields[6]),
      CursoAnterior: cleanValue(fields[7]),
      TurnoAnterior: cleanValue(fields[8]),
      Sexo: cleanValue(fields[9]),
      Nome_Pai: cleanValue(fields[10]),
      Profissao_Pai: cleanValue(fields[11]),
      Telefone_Pai: cleanValue(fields[13]),
      CPF_Pai: cleanValue(fields[16]),
      Nome_Mae: cleanValue(fields[17]),
      Telefone_Mae: cleanValue(fields[20]),
      CPF_Mae: cleanValue(fields[23]),
      Endereco_Aluno: cleanValue(fields[25]),
      Telefone_Aluno: cleanValue(fields[26]),
      Nome_Responsavel: cleanValue(fields[27]),
      IrmaosCreche: cleanValue(fields[35]),
      Dados_Irmaos: cleanValue(fields[36]),
      EscolaOrigem: cleanValue(fields[38]),
      Cod_Turma: cleanValue(fields[39]),
      Cod_Turno: cleanValue(fields[40]),
      Cod_HorasContratadas: cleanValue(fields[41]),
    };
    requerimentos.push(row);
  }

  console.log(requerimentos.length + " requerimentos");

  const conn = await mysql.createConnection({ host: DB_HOST, user: "root", password: DB_PASS, database: "recrescer" });

  function getInsertId(result) { return result[0].insertId; }

  console.log("Limpando...");
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of ["medical_records","enrollments","students","mothers","fathers","classes","shifts"]) {
    try { await conn.query("DELETE FROM " + t); } catch(e) {}
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  // Turnos -> shifts
  const turnoToShift = {};
  for (const [cod, name] of [[1,"Parcial manhã"],[2,"Parcial tarde"],[3,"Integral"],[5,"Ampliado"]]) {
    const r = await conn.query("INSERT INTO shifts (name) VALUES (?)", [name]);
    turnoToShift[cod] = getInsertId(r);
  }

  // Classes: combinar turma+turno
  const ttMap = {};
  function getEduAndGrade(desc) {
    let edu = null;
    if (desc.includes("Berçário") || desc.includes("Maternal")) edu = "Creche";
    else if (desc.includes("Pré-Escola")) edu = "Educação Infantil";
    else if (desc.includes("1º Ano do E.F")) edu = "Ensino Fundamental";
    let grade = desc.split(" / ")[0].trim();
    return { edu, grade };
  }

  const turmasDefs = [
    { cod: 1, base: "Berçário I" }, { cod: 2, base: "Berçário II" },
    { cod: 4, base: "Maternal I" }, { cod: 5, base: "Maternal I" },
    { cod: 6, base: "Maternal II" }, { cod: 7, base: "Maternal II" },
    { cod: 8, base: "Pré-Escola I" }, { cod: 9, base: "Pré-Escola I" },
    { cod: 10, base: "Pré-Escola II" },
    { cod: 17, base: "1º Ano do E.F." }, { cod: 18, base: "1º Ano do E.F." },
    { cod: 21, base: "Pré-Escola II" },
  ];

  const turnoNames = { 1:"Manhã", 2:"Tarde", 3:"Integral", 5:"Ampliado" };

  for (const tm of turmasDefs) {
    for (const turnoCod of [1,2,3,5]) {
      const classDesc = tm.base + " / " + turnoNames[turnoCod];
      const { edu, grade } = getEduAndGrade(classDesc);
      const r = await conn.query("INSERT INTO classes (name, grade, education_level) VALUES (?, ?, ?)", [classDesc, grade, edu]);
      ttMap[tm.cod + "_" + turnoCod] = getInsertId(r);
    }
  }

  console.log("Classes: " + Object.keys(ttMap).length);

  const paisSeen = {};
  const maesSeen = {};
  const alunosSeen = {};

  if (!isDryRun) {
    for (let idx = 0; idx < requerimentos.length; idx++) {
      const req = requerimentos[idx];
      const nomeAluno = String(req.Nome_Aluno || "").trim();
      if (!nomeAluno) continue;

      let birthDate = null;
      if (req.Data_Nascimento) try { birthDate = String(req.Data_Nascimento).substring(0, 19); } catch(_) {}

      // Pai
      let fatherId = null;
      if (req.Nome_Pai) {
        const key = req.Nome_Pai.toLowerCase().trim();
        if (!(key in paisSeen)) {
          const cpfPai = req.CPF_Pai && String(req.CPF_Pai).length > 5 ? String(req.CPF_Pai) : null;
          const telPai = req.Telefone_Pai && String(req.Telefone_Pai).length > 5 ? String(req.Telefone_Pai) : null;
          const r = await conn.query("INSERT INTO fathers (name, cpf, residential_address, residential_phone) VALUES (?, ?, ?, ?)", [req.Nome_Pai, cpfPai || null, req.Endereco_Aluno || null, telPai || null]);
          paisSeen[key] = getInsertId(r);
          fatherId = paisSeen[key];
        } else { fatherId = paisSeen[key]; }
      }

      // Mãe
      let motherId = null;
      if (req.Nome_Mae) {
        const key = req.Nome_Mae.toLowerCase().trim();
        if (!(key in maesSeen)) {
          const cpfMae = req.CPF_Mae && String(req.CPF_Mae).length > 5 ? String(req.CPF_Mae) : null;
          const telMae = req.Telefone_Mae && String(req.Telefone_Mae).length > 5 ? String(req.Telefone_Mae) : null;
          const r = await conn.query("INSERT INTO mothers (name, cpf, residential_address, residential_phone) VALUES (?, ?, ?, ?)", [req.Nome_Mae, cpfMae || null, req.Endereco_Aluno || null, telMae || null]);
          maesSeen[key] = getInsertId(r);
          motherId = maesSeen[key];
        } else { motherId = maesSeen[key]; }
      }

      // Aluno
      const alunoKey = nomeAluno.toLowerCase().trim() + "|" + (req.Data_Nascimento || "");
      let studentId = null;
      if (!(alunoKey in alunosSeen)) {
        const serieVal = req.SerieAnterior && String(req.SerieAnterior).trim().toLowerCase() !== "am" ? String(req.SerieAnterior) : null;
        const nacionalidade = req.Nacionalidade && String(req.Nacionalidade).length > 1 ? String(req.Nacionalidade) : null;
        const naturalidade = req.Naturalidade && String(req.Naturalidade).length > 1 ? String(req.Naturalidade) : null;

        const r = await conn.query("INSERT INTO students (registration, name, birth_date, gender, nationality, birthplace, grade, father_id, mother_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
          String(req.Cod_Requerimento), nomeAluno, birthDate, req.Sexo || null, nacionalidade, naturalidade, serieVal, fatherId, motherId,
        ]);
        alunosSeen[alunoKey] = { id: getInsertId(r) };
        studentId = alunosSeen[alunoKey].id;
      } else { studentId = alunosSeen[alunoKey].id; }

      // Matrícula
      let year;
      if (typeof req.Ano_Requerimento === "number") year = req.Ano_Requerimento;
      else if (typeof req.Ano_Requerimento === "string" && req.Ano_Requerimento.length === 4) year = parseInt(req.Ano_Requerimento);
      else year = 2026;

      let requestedClassId = null, requestedShiftId = null, contractedHours = null;
      const turmaCod = req.Cod_Turma;
      const turnoCod = req.Cod_Turno;

      if (turmaCod !== null) {
        const key = turmaCod + "_" + turnoCod;
        requestedClassId = ttMap[key] || null;
      }
      if (turnoCod !== null) {
        requestedShiftId = turnoToShift[turnoCod] || null;
      }

      if (req.Cod_HorasContratadas !== null && req.Cod_HorasContratadas !== undefined) {
        const horasMap = { 1:"04:30h", 2:"05:00h", 3:"06:00h", 4:"07:00h", 5:"08:00h", 6:"09:00h", 7:"10:00h", 8:"11:00h", 9:"12:00h", 11:"05:30h" };
        contractedHours = horasMap[req.Cod_HorasContratadas] || null;
      }

      const IrmaosCreche = req.IrmaosCreche;
      const irmaosBool = IrmaosCreche === "1" || IrmaosCreche === "bN'1'" ? 1 : 0;
      let siblingDetails = null;
      if (irmaosBool && req.Dados_Irmaos) siblingDetails = String(req.Dados_Irmaos).trim() || null;

      const nomeResp = String(req.Nome_Responsavel || "").trim();
      const livesWith = (nomeResp === req.Nome_Mae || !nomeResp) ? "Mãe" : (nomeResp || null);

      let originSchool = null;
      if (req.EscolaOrigem && String(req.EscolaOrigem).trim().toLowerCase() !== "a própria") originSchool = String(req.EscolaOrigem).trim() || null;

      const [r] = await conn.query(
        "INSERT INTO enrollments (year, student_id, previous_grade_course_shift, lives_with, siblings_in_daycare, siblings_details, new_student, origin_school, requested_class_id, requested_shift_id, contracted_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [year, studentId, null, livesWith, irmaosBool, siblingDetails, 1, originSchool, requestedClassId, requestedShiftId, contractedHours]
      );

      if (idx % 30 === 0 || idx === requerimentos.length - 1) {
        console.log("Req " + (idx+1) + "/" + requerimentos.length + ": " + nomeAluno.substring(0,25) + " | turma: " + (turmaCod||"?") + "/" + (turnoCod||"?" ) + " class:" + (requestedClassId || "NULL"));
      }
    }
  }

  console.log("Verificação:");
  for (const t of ["students","mothers","fathers","enrollments"]) {
    const [r] = await conn.query("SELECT COUNT(*) as cnt FROM " + t);
    console.log(t + ": " + r[0].cnt);
  }

  if (dryRun !== "dry-run") {
    const [s] = await conn.query("SELECT COUNT(*) as cnt FROM students");
    const [f] = await conn.query("SELECT COUNT(*) as cnt FROM fathers");
    const [m] = await conn.query("SELECT COUNT(*) as cnt FROM mothers");
    const [e] = await conn.query("SELECT COUNT(*) as cnt FROM enrollments");
    const [a] = await conn.query("SELECT COUNT(*) as cnt FROM enrollments WHERE requested_class_id IS NOT NULL AND requested_shift_id IS NOT NULL");
    console.log("");
    console.log("RESUMO: " + e[0].cnt + " matrículas | turmas/turno: " + a[0].cnt);
  }

  await conn.end();
}

const args = process.argv.slice(2);
run(args.includes("--dry-run") ? "dry-run" : false).then(s => process.exit(s ? 0 : 1)).catch(e => { console.error("Error:", e.message); process.exit(1); });
