const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/data/recrescer.db");

console.log(JSON.stringify(db.prepare("SELECT id, name, login FROM users").all()));
