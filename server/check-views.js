const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/data/recrescer.db");
const views = db.prepare("SELECT name, type FROM sqlite_master WHERE type='view'").all();
console.log(JSON.stringify(views));
