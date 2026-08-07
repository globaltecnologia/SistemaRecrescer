const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/data/recrescer.db");

console.log("Shifts:");
console.log(JSON.stringify(db.prepare("SELECT id, name FROM shifts").all()));

console.log("\nClasses:");
console.log(JSON.stringify(db.prepare("SELECT id, name, shift_id FROM classes LIMIT 5").all()));

console.log("\nEnrollments with vw_enrollments:");
console.log(JSON.stringify(db.prepare("SELECT id, year, student_name, class_name, shift_name FROM vw_enrollments LIMIT 3").all()));
