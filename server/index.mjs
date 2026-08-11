import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 3001);
const mysqlSslMode = process.env.MYSQL_SSL_MODE ?? "disabled";
if (!new Set(["disabled", "required"]).has(mysqlSslMode)) {
  throw new Error("MYSQL_SSL_MODE deve ser disabled ou required.");
}
const mysqlSslCa = process.env.MYSQL_SSL_CA_BASE64
  ? Buffer.from(process.env.MYSQL_SSL_CA_BASE64, "base64").toString("utf8")
  : undefined;
const databaseConfig = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "recrescer",
  password: process.env.MYSQL_PASSWORD ?? "recrescer",
  database: process.env.MYSQL_DATABASE ?? "recrescer",
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
  charset: "utf8mb4",
  timezone: "Z",
  ssl: mysqlSslMode === "required"
    ? { rejectUnauthorized: true, ...(mysqlSslCa ? { ca: mysqlSslCa } : {}) }
    : undefined,
};
const db = mysql.createPool(databaseConfig);

async function query(sql, parameters = []) {
  const [rows] = await db.execute(sql, parameters);
  return rows;
}

async function initializeDatabase() {
  const schema = readFileSync(resolve(root, "server/schema.sql"), "utf8");
  await db.query(schema);
}

const entities = {
  shifts: ["name"],
  classes: ["name", "school_year", "grade", "education_level", "shift_id"],
  fathers: ["name", "cpf", "residential_address", "residential_number", "residential_complement", "residential_district", "residential_city", "residential_state", "residential_zip", "residential_phone", "commercial_address", "commercial_number", "commercial_complement", "commercial_district", "commercial_city", "commercial_state", "commercial_zip", "commercial_phone"],
  mothers: ["name", "cpf", "residential_address", "residential_number", "residential_complement", "residential_district", "residential_city", "residential_state", "residential_zip", "residential_phone", "commercial_address", "commercial_number", "commercial_complement", "commercial_district", "commercial_city", "commercial_state", "commercial_zip", "commercial_phone"],
  students: ["registration", 
    "name", 
    "birth_date", 
    "gender", 
    "nationality", 
    "birthplace", 
    "grade", 
    "education_level", 
    "class_id", 
    "shift_id", 
    "health_plan", 
    "blood_type", 
    "rh_factor", 
    "address", 
    "phone", 
    "fp", 
    "ff", 
    "scholarship", 
    "first_installment", 
    "pm", 
    "siblings_at_school", 
    "father_id", 
    "mother_id", 
    "notes", 
    "active"],
  enrollments: ["year", "student_id", "previous_grade_course_shift", "lives_with", "guardian_name", "guardian_relationship", "siblings_in_daycare", "siblings_details", "new_student", "origin_school", "requested_class_id", "requested_shift_id", "contracted_hours"],
  medical_records: [
    "student_id", 
    "emergency_contact_name", 
    "emergency_contact_relationship", 
    "emergency_contact_phone", 
    "secondary_contact_name", 
    "secondary_contact_relationship", 
    "secondary_contact_phone", 
    "health_plan", 
    "emergency_hospital", 
    "measles", 
    "chickenpox", 
    "mumps", 
    "rubella", 
    "pertussis", 
    "other_common_diseases", 
    "allergies", 
    "fever_medication", 
    "tetanus_vaccine", 
    "tetanus_vaccine_date", 
    "respiratory_disease", 
    "neurological_disease", 
    "blood_type", 
    "rh_factor", 
    "notes"],
};

const reports = {
  "enrollment-form": "vw_enrollment_forms",
  "medical-form": "vw_medical_forms",
  "attendance-list": "vw_attendance_list",
  "students-by-class": "vw_students_by_class",
};

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password, stored) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(status === 204 ? undefined : JSON.stringify(payload));
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("JSON inválido.");
  }
}

async function authenticatedUser(request) {
  const authorization = request.headers.authorization ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const rows = await query(`
    SELECT u.id, u.name, u.login
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.expires_at > CURRENT_TIMESTAMP
       AND u.active = 1
  `, [hashToken(authorization.slice(7))]);
  return rows[0] ?? null;
}

function cleanValues(source, allowed) {
  return Object.fromEntries(
    allowed
      .filter((key) => Object.hasOwn(source, key))
      .map((key) => {
        const value = source[key];
        return [key, value === "" ? null : typeof value === "boolean" ? Number(value) : value];
      }),
  );
}

async function createEntity(table, allowed, values) {
  const cleaned = cleanValues(values, allowed);
  const columns = Object.keys(cleaned);
  if (!columns.length) throw new Error("Nenhum campo informado.");
  const placeholders = columns.map(() => "?").join(", ");
  const result = await query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    columns.map((key) => cleaned[key]),
  );
  const rows = await query(`SELECT * FROM ${table} WHERE id = ?`, [result.insertId]);
  return rows[0];
}

async function updateEntity(table, allowed, id, values) {
  const cleaned = cleanValues(values, allowed);
  const columns = Object.keys(cleaned);
  if (!columns.length) throw new Error("Nenhum campo informado.");
  await query(
    `UPDATE ${table} SET ${columns.map((key) => `${key} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...columns.map((key) => cleaned[key]), id],
  );
  const rows = await query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return rows[0];
}

async function ensureAdmin() {
  const [row] = await query("SELECT COUNT(*) AS total FROM users");
  if (Number(row.total) > 0) return;
  const login = process.env.ADMIN_LOGIN ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "recrescer";
  await query("INSERT INTO users (name, login, password_hash) VALUES (?, ?, ?)", [
    "Administrador",
    login,
    hashPassword(password),
  ]);
  console.warn(`Usuário inicial criado: ${login}. Altere a senha após o primeiro acesso.`);
}

async function handleEnrollmentComplete(request, response) {
  const body = await readBody(request);
  if (!body || (!body.student && !body.enrollment)) {
    return sendJson(response, 400, { error: "Dados de aluno ou matrícula são obrigatórios." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // --- 1. Pai (se fornecido) ---
    let fatherId = null;
    if (body.father) {
      const existing = body.father.id && body.father.id > 0
        ? await connection.query("SELECT id FROM fathers WHERE id = ?", [body.father.id])[0][0] ?? null
        : null;
      if (existing) {
        fatherId = existing.id;
        const fields = ["name","cpf","residential_address","residential_number","residential_complement","residential_district","residential_city","residential_state","residential_zip","residential_phone","commercial_address","commercial_number","commercial_complement","commercial_district","commercial_city","commercial_state","commercial_zip","commercial_phone"]
          .filter(k => Object.hasOwn(body.father, k));
        const sets = fields.map(f => `${f} = ?`).join(", ");
        await connection.query(`UPDATE fathers SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [...fields.map(f => body.father[f] === "" ? null : body.father[f]), fatherId]);
      } else {
        const insertFields = fields = ["name","cpf","residential_address","residential_number","residential_complement","residential_district","residential_city","residential_state","residential_zip","residential_phone","commercial_address","commercial_number","commercial_complement","commercial_district","commercial_city","commercial_state","commercial_zip","commercial_phone"]
          .filter(k => body.father[k] !== undefined && body.father[k] !== "");
        const placeholders = insertFields.map(() => "?").join(", ");
        if (insertFields.length > 0) {
          const result = await connection.query(
            `INSERT INTO fathers (${insertFields.join(", ")}) VALUES (${placeholders})`,
            insertFields.map(f => body.father[f] === "" ? null : body.father[f]));
          fatherId = result.insertId;
        }
      }
    }

    // --- 2. Mãe (se fornecido) ---
    let motherId = null;
    if (body.mother) {
      const existing = body.mother.id && body.mother.id > 0
        ? await connection.query("SELECT id FROM mothers WHERE id = ?", [body.mother.id])[0][0] ?? null
        : null;
      if (existing) {
        motherId = existing.id;
        const fields = ["name","cpf","residential_address","residential_number","residential_complement","residential_district","residential_city","residential_state","residential_zip","residential_phone","commercial_address","commercial_number","commercial_complement","commercial_district","commercial_city","commercial_state","commercial_zip","commercial_phone"]
          .filter(k => Object.hasOwn(body.mother, k));
        const sets = fields.map(f => `${f} = ?`).join(", ");
        await connection.query(`UPDATE mothers SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [...fields.map(f => body.mother[f] === "" ? null : body.mother[f]), motherId]);
      } else {
        const insertFields = ["name","cpf","residential_address","residential_number","residential_complement","residential_district","residential_city","residential_state","residential_zip","residential_phone","commercial_address","commercial_number","commercial_complement","commercial_district","commercial_city","commercial_state","commercial_zip","commercial_phone"]
          .filter(k => body.mother[k] !== undefined && body.mother[k] !== "");
        const placeholders = insertFields.map(() => "?").join(", ");
        if (insertFields.length > 0) {
          const result = await connection.query(
            `INSERT INTO mothers (${insertFields.join(", ")}) VALUES (${placeholders})`,
            insertFields.map(f => body.mother[f] === "" ? null : body.mother[f]));
          motherId = result.insertId;
        }
      }
    }

    // --- 3. Aluno ---
    let studentId = null;
    const s = body.student;
    if (s.id && s.id > 0) {
      studentId = s.id;
      const fields = ["registration","name","birth_date","gender","nationality","birthplace","grade","education_level","class_id","shift_id","health_plan","blood_type","rh_factor","address","phone","fp","ff","scholarship","first_installment","pm","siblings_at_school","father_id","mother_id","notes","active"]
        .filter(k => Object.hasOwn(s, k));
      const sets = fields.map(f => `${f} = ?`).join(", ");
      await connection.query(`UPDATE students SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...fields.map(f => s[f] === "" ? null : s[f]), studentId]);
    } else {
      const insertFields = ["registration","name","birth_date","gender","nationality","birthplace","grade","education_level","class_id","shift_id","health_plan","blood_type","rh_factor","address","phone","fp","ff","scholarship","first_installment","pm","siblings_at_school","father_id","mother_id","notes","active"]
        .filter(k => s[k] !== undefined && s[k] !== "" && s[k] !== null);
      const placeholders = insertFields.map(() => "?").join(", ");
      if (insertFields.length > 1) {
        const result = await connection.query(
          `INSERT INTO students (${insertFields.join(", ")}) VALUES (${placeholders})`,
          insertFields.map(f => s[f]));
        studentId = result.insertId;
      }
    }

    if (!studentId) {
      return sendJson(response, 400, { error: "É necessário informar ao menos o nome do aluno." });
    }

    // --- 4. Vincular pai/mãe se novo e não foram vinculados ainda pelo form student ---
    if (!s.father_id && fatherId) {
      await connection.query("UPDATE students SET father_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [fatherId, studentId]);
    }
    if (!s.mother_id && motherId) {
      await connection.query("UPDATE students SET mother_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [motherId, studentId]);
    }

    // --- 5. Matrícula ---
    const e = body.enrollment;
    if (e) {
      const allowed = ["year", "student_id", "previous_grade_course_shift", "lives_with", "guardian_name", "guardian_relationship", "siblings_in_daycare", "siblings_details", "new_student", "origin_school", "requested_class_id", "requested_shift_id", "contracted_hours"];
      const enrollmentData = Object.fromEntries(
        allowed.filter(k => e[k] !== undefined).map(k => [k, e[k]]));
      // student_id aponta pro aluno criado/existente
      enrollmentData.student_id = studentId;
      const fields = Object.keys(enrollmentData);
      const placeholders = fields.map(() => "?").join(", ");
      if (fields.length > 0) {
        await connection.query(
          `INSERT INTO enrollments (${fields.join(", ")}) VALUES (${placeholders})`,
          fields.map(f => enrollmentData[f]));
      }
    }

    await connection.commit();

    // Retorna tudo criado/atualizado para o frontend
    const [updatedStudent] = await query("SELECT * FROM students WHERE id = ?", [studentId]);
    sendJson(response, 201, {
      student: updatedStudent,
      fatherId,
      motherId,
    });
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : "Erro interno.";
    sendJson(response, 500, { error: `Falha ao salvar matrícula completa: ${message}` });
  } finally {
    connection.release();
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = request.method ?? "GET";

    if (path === "/api/health" && method === "GET") {
      return sendJson(response, 200, { status: "ok" });
    }

    if (path === "/api/auth/login" && method === "POST") {
      const values = await readBody(request);
      const login = String(values.login ?? values.username ?? "");
      const users = await query(
        "SELECT * FROM users WHERE LOWER(login) = LOWER(?) AND active = 1",
        [login],
      );
      const user = users[0];
      if (!user || !passwordMatches(String(values.password ?? ""), user.password_hash)) {
        return sendJson(response, 401, { error: "Login ou senha inválidos." });
      }
      const token = randomBytes(32).toString("base64url");
      await query(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 12 HOUR))",
        [hashToken(token), user.id],
      );
      return sendJson(response, 200, {
        token,
        user: { id: user.id, name: user.name, login: user.login },
      });
    }

    const user = await authenticatedUser(request);
    if (!user) return sendJson(response, 401, { error: "Sessão ausente ou expirada." });

    if (path === "/api/auth/me" && method === "GET") {
      return sendJson(response, 200, { user });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      const token = (request.headers.authorization ?? "").slice(7);
      await query("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
      return sendJson(response, 204, null);
    }

    if (path === "/api/users" && method === "GET") {
      return sendJson(response, 200, await query(
        "SELECT id, name, login, active, created_at, updated_at FROM users ORDER BY name",
      ));
    }
    if (path === "/api/users" && method === "POST") {
      const values = await readBody(request);
      if (!values.name || !values.login || !values.password) {
        return sendJson(response, 400, { error: "Nome, login e senha são obrigatórios." });
      }
      const result = await query(
        "INSERT INTO users (name, login, password_hash, active) VALUES (?, ?, ?, ?)",
        [values.name, values.login, hashPassword(String(values.password)), values.active === false ? 0 : 1]);
      const created = await query(
        "SELECT id, name, login, active FROM users WHERE id = ?",
        [result.insertId]);
      return sendJson(response, 201, created[0]);
    }

    const userMatch = path.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && method === "PUT") {
      const values = await readBody(request);
      const id = Number(userMatch[1]);
      const currentRows = await query("SELECT * FROM users WHERE id = ?", [id]);
      const current = currentRows[0];
      if (!current) return sendJson(response, 404, { error: "Usuário não encontrado." });
      await query(`
        UPDATE users
           SET name = ?, login = ?, active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
      `, [
        values.name ?? current.name,
        values.login ?? current.login,
        values.active === undefined ? current.active : values.active ? 1 : 0,
        values.password ? hashPassword(String(values.password)) : current.password_hash,
        id,
      ]);
      const updated = await query(
        "SELECT id, name, login, active FROM users WHERE id = ?",
        [id]);
      return sendJson(response, 200, updated[0]);
    }
    if (userMatch && method === "DELETE") {
      const id = Number(userMatch[1]);
      if (id === user.id) {
        return sendJson(response, 400, { error: "O usuário autenticado não pode excluir a própria conta." });
      }
      await query("DELETE FROM users WHERE id = ?", [id]);
      return sendJson(response, 204, null);
    }

    const reportMatch = path.match(/^\/api\/reports\/([a-z-]+)$/);
    if (reportMatch && method === "GET") {
      const view = reports[reportMatch[1]];
      if (!view) return sendJson(response, 404, { error: "Relatório não encontrado." });
      return sendJson(response, 200, await query(`SELECT * FROM ${view}`));
    }

    // Novo endpoint: matrícula completa com criação automática de aluno/pais
    const enrollmentCompleteMatch = path === "/api/enrollments/complete" && method === "POST";
    if (enrollmentCompleteMatch) {
      return await handleEnrollmentComplete(request, response);
    }

    const entityMatch = path.match(/^\/api\/([a-z_]+)(?:\/(\d+))?$/);
    if (entityMatch) {
      const table = entityMatch[1];
      const allowed = entities[table];
      if (!allowed) return sendJson(response, 404, { error: "Recurso não encontrado." });
      const id = entityMatch[2] ? Number(entityMatch[2]) : null;
      // Exceção para medical_records: usar a view que já tem o nome do aluno
      const sourceTable = table === "medical_records" && id === null ? "vw_medical_forms" : table;
      if (method === "GET" && id === null) {
        return sendJson(response, 200, await query(`SELECT * FROM ${sourceTable} ORDER BY id DESC`));
      }
      if (method === "POST" && id === null) {
        return sendJson(response, 201, await createEntity(table, allowed, await readBody(request)));
      }
      if (method === "PUT" && id !== null) {
        return sendJson(response, 200, await updateEntity(table, allowed, id, await readBody(request)));
      }
      if (method === "DELETE" && id !== null) {
        await query(`DELETE FROM ${table} WHERE id = ?`, [id]);
        return sendJson(response, 204, null);
      }
    }

    return sendJson(response, 404, { error: "Recurso não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const conflict = error?.code === "ER_DUP_ENTRY";
    sendJson(response, conflict ? 409 : 400, {
      error: conflict ? "Já existe um registro com esses dados." : message,
    });
  }
});

async function start() {
  await initializeDatabase();
  await ensureAdmin();
  await query("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP");
  server.listen(port, "0.0.0.0", () => {
    console.log(`Recrescer API ouvindo na porta ${port}`);
  });
}

start().catch((error) => {
  console.error("Não foi possível iniciar a API:", error.message);
  process.exit(1);
});
