#!/usr/bin/env node
/**
 * migrate_legacy.mjs — Migrar dados do legado Recrescer (SQL Server dump)
 * para o Sistema Recrescer (MySQL) via mysql2.
 *
 * Uso:
 *   docker compose -f compose.yaml exec api node migrate_legacy.mjs --dry-run
 *   docker compose -f compose.yaml exec api node migrate_legacy.mjs --clear
 *   docker compose -f compose.yaml exec api node migrate_legacy.mjs --reset
 */

import fs from 'fs';
import mysql from 'mysql2/promise';

// ── Configuração ──

const LEGADO_SQL = '/tmp/database.sql';
const SCHEMA_PATH = '/app/server/schema.sql';

const DB_HOST = '172.30.0.2';
const DB_PORT = 3306;
const DB_USER = 'root';
const DB_PASS = '5fb506ee6d2770619e4a7adeef86655d24c8f7ed2a1ea3f65f2d5daf1f2b8dcc';
const DB_NAME = 'recrescer';

// ── Parser T-SQL ──

function splitByExternalCommas(s) {
  const fields = [];
  let start = 0;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inString) {
      inString = true;
    } else if (ch === "'" && inString) {
      if (i + 1 < s.length && s[i + 1] === "'") { i += 1; continue; }
      else { inString = false; }
    } else if (ch === ',' && !inString) {
      fields.push(s.substring(start, i).trim());
      start = i + 1;
    }
  }
  const last = s.substring(start).trim().replace(/\)\s*$/, '').trim();
  if (last) fields.push(last);
  return fields;
}

function cleanValue(raw) {
  raw = raw.trim();
  if (raw.startsWith("N'") && raw.endsWith("'")) return raw.substring(2, raw.length - 1).replace(/''/g, "'");
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.substring(1, raw.length - 1).replace(/''/g, "'");
  if (raw === "bN'0'") return '0';
  if (raw === "bN'1'") return '1';
  if (raw === 'NULL') return null;
  const num = parseInt(raw, 10);
  if (!isNaN(num) && String(num) === raw.trim()) return num;
  return raw;
}

// ── Extração ──

function extractRequerimentos(sqlPath) {
  const content = fs.readFileSync(sqlPath, 'utf-8');
  const headerMatch = content.match(/INSERT INTO "RE_Requerimento"\s*\(([^)]+)\)/);
  if (!headerMatch) throw new Error('Não encontrou cabeçalho INSERT RE_Requerimento');
  const cols = headerMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));

  const reqIdx = content.indexOf('INSERT INTO "RE_Requerimento"');
  const afterVals = content.substring(reqIdx).split(/VALUES\s*\n/);
  let dataBlock = afterVals[1] || '';
  const em = dataBlock.search(/ALTER TABLE "RE_Requerimento" ENABLE KEYS/);
  if (em >= 0) dataBlock = dataBlock.substring(0, em);

  const lines = dataBlock.split('\n').filter(l => l.includes('(') && l.includes("N'"));
  const requerimentos = [];
  for (const line of lines) {
    const fields = splitByExternalCommas(line);
    const row = {};
    for (let i = 0; i < cols.length; i++) {
      row[cols[i]] = i < fields.length ? cleanValue(fields[i]) : null;
    }
    requerimentos.push(row);
  }
  return requerimentos;
}

function extractReferenceTables(sqlPath) {
  const content = fs.readFileSync(sqlPath, 'utf-8');
  /** @type Record<string, any[]> */
  const result = {};
  for (const table of ['RE_Turma', 'RE_Turno', 'RE_HorasContratadas', 'RE_TipoResidencia']) {
    const pattern = new RegExp(`INSERT INTO "${table}"\\s*\\(([^)]+)\\)`);
    const m = content.match(pattern);
    if (!m) continue;
    const cols = m[1].split(',').map(c => c.trim().replace(/"/g, ''));
    const insertIdx = content.indexOf(`INSERT INTO "${table}"`);
    if (insertIdx < 0) continue;
    const afterVals = content.substring(insertIdx).split(/VALUES\s*\n/);
    let dataBlock = afterVals[1] || '';
    const ep = new RegExp(`ALTER TABLE "${table}" ENABLE KEYS`);
    const e = dataBlock.search(ep);
    if (e >= 0) dataBlock = dataBlock.substring(0, e);
    const lines = dataBlock.split('\n').filter(l => l.includes('('));
    const rows = [];
    for (const line of lines) {
      const fields = splitByExternalCommas(line);
      const row = {};
      for (let i = 0; i < cols.length; i++) {
        row[cols[i]] = i < fields.length ? cleanValue(fields[i]) : null;
      }
      rows.push(row);
    }
    result[table] = rows;
  }
  return result;
}

// ── Banco ──

async function getConnection() {
  return mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS, database: DB_NAME });
}

function getLastId(conn) { return conn._lastInsertId || 0; }

function saveLastId(conn, result) {
  // mysql2 retorna ResultSetHeader com insertId em single INSERT
  if (result && typeof result.insertId === 'number' && result.insertId > 0) {
    conn._lastInsertId = result.insertId;
  } else if (Array.isArray(result) && result.length >= 1 && typeof result[0].insertId === 'number') {
    conn._lastInsertId = result[0].insertId;
  }
}

async function clearDatabase(conn) {
  const tables = ['medical_records', 'enrollments', 'students', 'mothers', 'fathers', 'classes', 'shifts', 'sessions'];
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    try { await conn.query(`DELETE FROM \`${table}\``); console.log(`  Limpo: ${table}`); }
    catch (e) { console.log(`  SKIP: ${table} → ${e.message}`); }
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function truncateAndReset(conn) {
  const tables = ['medical_records', 'enrollments', 'students', 'mothers', 'fathers', 'classes', 'shifts', 'sessions', 'users'];
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) { try { await conn.query(`DROP TABLE IF EXISTS \`${table}\``); } catch (_) {} }
  const views = ['vw_enrollments', 'vw_enrollment_forms', 'vw_medical_forms', 'vw_attendance_list', 'vw_students_by_class'];
  for (const v of views) { try { await conn.query(`DROP VIEW IF EXISTS \`${v}\``); } catch (_) {} }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    const stmts = schemaSql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('DELIMITER'));
    for (const stmt of stmts) {
      try { await conn.query(stmt); } catch (e) { if (!e.message.toLowerCase().includes('already exists')) console.log(`  WARN: ${stmt.substring(0, 60)} → ${e.message}`); }
    }
  }
}

// ── Migração ──

async function runMigration(dryRun) {
  const isDryRun = dryRun === 'dry-run';
  console.log('📂 Analisando dump legado...');
  const sqlFile = LEGADO_SQL;
  if (!fs.existsSync(sqlFile)) { throw new Error(`Arquivo não encontrado: ${sqlFile}`); }

  const requerimentos = extractRequerimentos(sqlFile);
  const refs = extractReferenceTables(sqlFile);
  console.log(`✅ Requerimentos: ${requerimentos.length}`);
  for (const [table, rows] of Object.entries(refs)) { console.log(`   ${table}: ${rows.length}`); }

  if (!requerimentos.length) { console.error('\n❌ Nenhum requerimento encontrado!'); return false; }

  const conn = await getConnection();

  if (dryRun === 'reset') { console.log('\n🧹 DROP + recriar...'); await truncateAndReset(conn); }
  else if (dryRun === 'clear') { console.log('\n🧹 Limpar dados...'); await clearDatabase(conn); }

  // ── Turnos → shifts ──
  const turnos = refs.RE_Turno || [];
  /** @type Record<number, number> */
  const turnoMap = {};
  if (!isDryRun) {
    await conn.query('DELETE FROM `shifts`');
    for (const t of turnos) {
      const cod = t.Cod_Turno;
      const desc = String(t.Desc_Turno || '').trim();
      if (!cod || !desc) continue;
      const [result] = await conn.query('INSERT INTO `shifts` (`name`) VALUES (?)', [desc]);
      saveLastId(conn, result);
      turnoMap[parseInt(cod)] = getLastId(conn);
    }
  }
  console.log(`\n🕐 Turnos → shifts: ${Object.keys(turnoMap).length} mapeados (${JSON.stringify(turnoMap)})`);

  // ── Turmas → classes ──
  const turmas = refs.RE_Turma || [];
  /** @type Record<number, number> */
  const turmaMap = {};
  if (!isDryRun) {
    await conn.query('DELETE FROM `classes`');
    for (const t of turmas) {
      const cod = t.Cod_Turma;
      const desc = String(t.Desc_Turma || '').trim();
      if (!cod || !desc) { console.log(`  ⚠️ Turma sem nome (${cod}) — pulada`); continue; }
      let eduLevel = null;
      const gradeName = desc.split(' / ')[0].trim();
      const eduMap = { 'Berçário': 'Creche', 'Maternal': 'Creche', 'Pré-Escola': 'Educação Infantil', '1º Ano do E.F': 'Ensino Fundamental' };
      for (const [key, val] of Object.entries(eduMap)) { if (gradeName.includes(key)) { eduLevel = val; break; } }
      const [result] = await conn.query('INSERT INTO `classes` (`name`, `grade`, `education_level`) VALUES (?, ?, ?)', [desc, desc, eduLevel]);
      saveLastId(conn, result);
      turmaMap[parseInt(cod)] = getLastId(conn);
    }
  }
  console.log(`\n🏫 Turmas → classes: ${Object.keys(turmaMap).length} criadas (${JSON.stringify(turmaMap)})`);

  // ── Processar requerimentos ──
  /** @type Record<string, number> */
  const paisSeen = {};
  /** @type Record<string, number> */
  const maesSeen = {};
  /** @type Record<string, {id: number}> */
  const alunosSeen = {};

  console.log(`\n📝 Processando ${requerimentos.length} requerimentos...`);
  if (!isDryRun) {
    for (let idx = 0; idx < requerimentos.length; idx++) {
      const req = requerimentos[idx];
      const nomeAluno = String(req.Nome_Aluno || '').trim();
      const nomePai = String(req.Nome_Pai || '').trim();
      const nomeMae = String(req.Nome_Mae || '').trim();
      if (!nomeAluno) continue;

      let birthDate = null;
      if (req.Data_Nascimento) { try { birthDate = String(req.Data_Nascimento).substring(0, 19); } catch (_) {} }

      // Pai
      let fatherId = null;
      if (nomePai) {
        const key = nomePai.toLowerCase().trim();
        if (!(key in paisSeen)) {
          const cpfPai = req.CPF_Pai && String(req.CPF_Pai).length > 5 ? String(req.CPF_Pai) : null;
          const telPai = req.Telefone_Pai && String(req.Telefone_Pai).length > 5 ? String(req.Telefone_Pai) : null;
          const [r] = await conn.query('INSERT INTO fathers (name, cpf, residential_address, residential_phone) VALUES (?, ?, ?, ?)', [nomePai, cpfPai || null, req.Endereco_Aluno || null, telPai || null]);
          saveLastId(conn, r);
          paisSeen[key] = getLastId(conn);
          fatherId = paisSeen[key];
        } else { fatherId = paisSeen[key]; }
      }

      // Mãe
      let motherId = null;
      if (nomeMae) {
        const key = nomeMae.toLowerCase().trim();
        if (!(key in maesSeen)) {
          const cpfMae = req.CPF_Mae && String(req.CPF_Mae).length > 5 ? String(req.CPF_Mae) : null;
          const telMae = req.Telefone_Mae && String(req.Telefone_Mae).length > 5 ? String(req.Telefone_Mae) : null;
          const [r] = await conn.query('INSERT INTO mothers (name, cpf, residential_address, residential_phone) VALUES (?, ?, ?, ?)', [nomeMae, cpfMae || null, req.Endereco_Aluno || null, telMae || null]);
          saveLastId(conn, r);
          maesSeen[key] = getLastId(conn);
          motherId = maesSeen[key];
        } else { motherId = maesSeen[key]; }
      }

      // Aluno
      const alunoKey = `${nomeAluno.toLowerCase()}|${req.Data_Nascimento || ''}`;
      let studentId = null;
      if (!(alunoKey in alunosSeen)) {
        const serieVal = req.SerieAnoAnterior && String(req.SerieAnoAnterior).trim().toLowerCase() !== 'am' ? String(req.SerieAnoAnterior) : null;
        const [r] = await conn.query('INSERT INTO students (registration, name, birth_date, gender, nationality, birthplace, grade, father_id, mother_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
          `LEGADO-${req.Cod_Requerimento}`, nomeAluno, birthDate, req.Sexo || null,
          (req.Nacionalidade && String(req.Nacionalidade).length > 1) ? String(req.Nacionalidade) : null,
          (req.Naturalidade && String(req.Naturalidade).length > 1) ? String(req.Naturalidade) : null,
          serieVal, fatherId, motherId,
        ]);
        saveLastId(conn, r);
        alunosSeen[alunoKey] = { id: getLastId(conn) };
        studentId = alunosSeen[alunoKey].id;
      } else { studentId = alunosSeen[alunoKey].id; }

      // Matrícula
      let year;
      if (typeof req.Ano_Requerimento === 'number') year = req.Ano_Requerimento;
      else if (typeof req.Ano_Requerimento === 'string' && req.Ano_Requerimento.length === 4) year = parseInt(req.Ano_Requerimento);
      else year = 2026;

      const turmaCod = req.Cod_Turma;
      const turnoCod = req.Cod_Turno;
      const horasCod = req.Cod_HorasContratadas;
      let requestedClassId = null, requestedShiftId = null, contractedHours = null;

      if (turmaCod !== null) {
        requestedClassId = turmaMap[parseInt(turmaCod)] || null;
        if (!requestedClassId && parseInt(turmaCod) > 0) console.log(`  ⚠️ Turma legacy ${turmaCod} não mapeada`);
      }
      if (turnoCod !== null) { requestedShiftId = turnoMap[parseInt(turnoCod)] || null; }
      if (horasCod !== null && horasCod !== undefined) {
        for (const h of refs.RE_HorasContratadas || []) {
          if (parseInt(h.Cod_HorasContratadas) === parseInt(horasCod)) { contractedHours = String(h.Desc_HorasContratadas).trim() || null; break; }
        }
      }

      const irmaosBool = req.IrmaosCreche === '1' || req.IrmaosCreche === "bN'1'" ? 1 : 0;
      let siblingDetails = null;
      if (irmaosBool && req.Dados_Irmaos) siblingDetails = String(req.Dados_Irmaos).trim() || null;

      const nomeResp = String(req.Nome_Responsavel || '').trim();
      const livesWith = (nomeResp === nomeMae || !nomeResp) ? 'Mãe' : (nomeResp || null);

      let originSchool = null;
      if (req.EscolaOrigem && String(req.EscolaOrigem).trim().toLowerCase() !== 'a própria') originSchool = String(req.EscolaOrigem).trim() || null;

      const [r] = await conn.query('INSERT INTO enrollments (year, student_id, previous_grade_course_shift, lives_with, siblings_in_daycare, siblings_details, new_student, origin_school, requested_class_id, requested_shift_id, contracted_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        year, studentId, null, livesWith, irmaosBool, siblingDetails, 1, originSchool, requestedClassId, requestedShiftId, contractedHours,
      ]);

      if (idx % 20 === 0 || idx === requerimentos.length - 1) {
        console.log(`  📋 Req ${idx + 1}/${requerimentos.length}: "${nomeAluno}" (${year})`);
      }
    }
  } else {
    for (let i = 0; i < Math.min(5, requerimentos.length); i++) {
      console.log(`  [DRY] Req ${i + 1}: "${requerimentos[i].Nome_Aluno}" (${requerimentos[i].Ano_Requerimento})`);
    }
  }

  // Verificação
  const checks = ['students', 'mothers', 'fathers', 'enrollments'];
  console.log('\n🔍 Verificação no banco:');
  for (const table of checks) {
    const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    console.log(`   ${cnt > 0 ? '✅' : '❌'} ${table}: ${cnt}`);
  }

  if (dryRun !== 'dry-run') {
    const [[{ cnt: s }]] = await conn.query('SELECT COUNT(*) as cnt FROM students');
    const [[{ cnt: m }]] = await conn.query('SELECT COUNT(*) as cnt FROM mothers');
    const [[{ cnt: f }]] = await conn.query('SELECT COUNT(*) as cnt FROM fathers');
    const [[{ cnt: e }]] = await conn.query('SELECT COUNT(*) as cnt FROM enrollments');
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(60));
    console.log(`   Requerimentos lidos:     ${requerimentos.length}`);
    console.log(`   Alunos criados:          ${s}`);
    console.log(`   Pais criados:            ${f}`);
    console.log(`   Mães criadas:            ${m}`);
    console.log(`   Matrículas criadas:      ${e}`);
  }

  await conn.end();
  return true;
}

// ── CLI ──
const args = process.argv.slice(2);
const dryRunArg = args.includes('--dry-run') ? 'dry-run' : args.includes('--clear') ? 'clear' : args.includes('--reset') ? 'reset' : false;
runMigration(dryRunArg).then(s => process.exit(s ? 0 : 1)).catch(e => { console.error('Erro:', e.message); process.exit(1); });
