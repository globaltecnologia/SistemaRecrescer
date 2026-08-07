import { createHash, randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const db = new DatabaseSync("/app/data/recrescer.db");
try {
  db.prepare("DELETE FROM users WHERE login = alexandre").run();
  const passwordHash = hashPassword("1234");
  db.prepare("INSERT INTO users (name, login, password_hash, active) VALUES (?, ?, ?, ?)").run("Alexandre", "alexandre", passwordHash, 1);
  console.log("ok");
} catch (e) {
  console.log(e.message);
}
