const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/data/recrescer.db");
console.log(JSON.stringify(db.prepare("SELECT id, year, student_name FROM enrollments LIMIT 1").all()));
