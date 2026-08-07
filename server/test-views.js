const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/data/recrescer.db");
console.log(JSON.stringify(db.prepare("SELECT id, year, student_name, class_name, shift_name FROM vw_enrollments LIMIT 2").all()));
