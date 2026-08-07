import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = process.env.DATA_DIR ?? resolve(root, "data");
const databaseFile = process.env.DATABASE_FILE ?? resolve(dataDirectory, "recrescer.db");
const port = Number(process.env.PORT ?? 3001);

mkdirSync(dataDirectory, { recursive: true });
const db = new DatabaseSync(databaseFile);
db.exec(readFileSync(resolve(root, "server/schema.sql"), "utf8"));

const entities = {
  shifts: ["name"],
  classes: ["name", "school_year", "grade", "education_level", "shift_id"],
  fathers: ["name", "cpf", "residential_address", "residential_number", "residential_complement", "residential_district", "residential_city", "residential_state", "residential_zip", "residential_phone", "commercial_address", "commercial_number", "commercial_complement", "commercial_district", "commercial_city", "commercial_state", "commercial_zip", "commercial_phone"],
  mothers: ["name", "cpf", "residential_address", "residential_number", "residential_complement", "residential_district", "residential_city", "residential_state", "residential_zip", "residential_phone", "commercial_address", "commercial_number", "commercial_complement", "commercial_district", "commercial_city", "commercial_state", "commercial_zip", "commercial_phone"],
  students: ["registration", "name", "birth_date", "gender", "nationality", "birthplace", "grade", "education_level", "class_id", "shift_id", "health_plan", "blood_type", "rh_factor", "address", "phone", "fp", "ff", "scholarship", "first_installment", "pm", "siblings_at_school", "father_id", "mother_id", "notes", "active"],
  enrollments: ["year", "student_id", "student_name", "birth_date", "nationality", "birthplace", "previous_grade_course_shift", "gender", "father_name", "father_phone", "father_cpf", "mother_name", "mother_phone", "mother_cpf", "lives_with", "student_address", "student_phone", "guardian_name", "guardian_relationship", "siblings_in_daycare", "siblings_details", "new_student", "origin_school", "requested_class_id", "requested_shift_id", "contracted_hours"],
  medical_records: ["student_id", "emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone", "secondary_contact_name", "secondary_contact_relationship", "secondary_contact_phone", "health_plan", "emergency_hospital", "measles", "chickenpox", "mumps", "rubella", "pertussis", "other_common_diseases", "allergies", "fever_medication", "tetanus_vaccine", "tetanus_vaccine_date", "respiratory_disease", "neurological_disease", "blood_type", "rh_factor", "notes"],
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

function authenticatedUser(request) {
  const authorization = request.headers.authorization ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  return db.prepare(`
    SELECT u.id, u.name, u.login
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.expires_at > datetime('now')
       AND u.active = 1
  `).get(hashToken(authorization.slice(7))) ?? null;
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

function createEntity(table, allowed, values) {
  const cleaned = cleanValues(values, allowed);
  const columns = Object.keys(cleaned);
  if (!columns.length) throw new Error("Nenhum campo informado.");
  const placeholders = columns.map(() => "?").join(", ");
  const result = db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
  ).run(...columns.map((key) => cleaned[key]));
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
}

function updateEntity(table, allowed, id, values) {
  const cleaned = cleanValues(values, allowed);
  const columns = Object.keys(cleaned);
  if (!columns.length) throw new Error("Nenhum campo informado.");
  db.prepare(
    `UPDATE ${table} SET ${columns.map((key) => `${key} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(...columns.map((key) => cleaned[key]), id);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

function ensureAdmin() {
  const row = db.prepare("SELECT COUNT(*) AS total FROM users").get();
  if (Number(row.total) > 0) return;
  const login = process.env.ADMIN_LOGIN ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "recrescer";
  db.prepare("INSERT INTO users (name, login, password_hash) VALUES (?, ?, ?)").run(
    "Administrador",
    login,
    hashPassword(password),
  );
  console.warn(`Usuário inicial criado: ${login}. Altere a senha após o primeiro acesso.`);
}

ensureAdmin();
db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();

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
      const user = db.prepare(
        "SELECT * FROM users WHERE login = ? COLLATE NOCASE AND active = 1",
      ).get(login);
      if (!user || !passwordMatches(String(values.password ?? ""), user.password_hash)) {
        return sendJson(response, 401, { error: "Login ou senha inválidos." });
      }
      const token = randomBytes(32).toString("base64url");
      db.prepare(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+12 hours'))",
      ).run(hashToken(token), user.id);
      return sendJson(response, 200, {
        token,
        user: { id: user.id, name: user.name, login: user.login },
      });
    }

    const user = authenticatedUser(request);
    if (!user) return sendJson(response, 401, { error: "Sessão ausente ou expirada." });

    if (path === "/api/auth/me" && method === "GET") {
      return sendJson(response, 200, { user });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      const token = (request.headers.authorization ?? "").slice(7);
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
      return sendJson(response, 204, null);
    }

    if (path === "/api/users" && method === "GET") {
      return sendJson(response, 200, db.prepare(
        "SELECT id, name, login, active, created_at, updated_at FROM users ORDER BY name",
      ).all());
    }
    if (path === "/api/users" && method === "POST") {
      const values = await readBody(request);
      if (!values.name || !values.login || !values.password) {
        return sendJson(response, 400, { error: "Nome, login e senha são obrigatórios." });
      }
      const result = db.prepare(
        "INSERT INTO users (name, login, password_hash, active) VALUES (?, ?, ?, ?)",
      ).run(values.name, values.login, hashPassword(String(values.password)), values.active === false ? 0 : 1);
      return sendJson(response, 201, db.prepare(
        "SELECT id, name, login, active FROM users WHERE id = ?",
      ).get(result.lastInsertRowid));
    }

    const userMatch = path.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && method === "PUT") {
      const values = await readBody(request);
      const id = Number(userMatch[1]);
      const current = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      if (!current) return sendJson(response, 404, { error: "Usuário não encontrado." });
      db.prepare(`
        UPDATE users
           SET name = ?, login = ?, active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
      `).run(
        values.name ?? current.name,
        values.login ?? current.login,
        values.active === undefined ? current.active : values.active ? 1 : 0,
        values.password ? hashPassword(String(values.password)) : current.password_hash,
        id,
      );
      return sendJson(response, 200, db.prepare(
        "SELECT id, name, login, active FROM users WHERE id = ?",
      ).get(id));
    }
    if (userMatch && method === "DELETE") {
      const id = Number(userMatch[1]);
      if (id === user.id) {
        return sendJson(response, 400, { error: "O usuário autenticado não pode excluir a própria conta." });
      }
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      return sendJson(response, 204, null);
    }

    const reportMatch = path.match(/^\/api\/reports\/([a-z-]+)$/);
    if (reportMatch && method === "GET") {
      const view = reports[reportMatch[1]];
      if (!view) return sendJson(response, 404, { error: "Relatório não encontrado." });
      return sendJson(response, 200, db.prepare(`SELECT * FROM ${view}`).all());
    }

    const entityMatch = path.match(/^\/api\/([a-z_]+)(?:\/(\d+))?$/);
    if (entityMatch) {
      const table = entityMatch[1];
      const allowed = entities[table];
      if (!allowed) return sendJson(response, 404, { error: "Recurso não encontrado." });
      const id = entityMatch[2] ? Number(entityMatch[2]) : null;
      if (method === "GET" && id === null) {
        return sendJson(response, 200, db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all());
      }
      if (method === "POST" && id === null) {
        return sendJson(response, 201, createEntity(table, allowed, await readBody(request)));
      }
      if (method === "PUT" && id !== null) {
        return sendJson(response, 200, updateEntity(table, allowed, id, await readBody(request)));
      }
      if (method === "DELETE" && id !== null) {
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
        return sendJson(response, 204, null);
      }
    }

    return sendJson(response, 404, { error: "Recurso não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const conflict = /UNIQUE constraint failed/i.test(message);
    sendJson(response, conflict ? 409 : 400, {
      error: conflict ? "Já existe um registro com esses dados." : message,
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Recrescer API ouvindo na porta ${port}`);
});
