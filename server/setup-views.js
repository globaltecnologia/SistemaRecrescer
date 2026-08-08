const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/data/recrescer.db");

// Dropear view se existir
try {
  db.prepare("DROP VIEW IF EXISTS vw_enrollments").run();
  console.log("View dropped.");
} catch (e) {
  console.log("No existing view to drop:", e.message);
}

// Criar nova view
const createView = `CREATE VIEW vw_enrollments AS
SELECT e.id, e.year, e.student_name, e.birth_date, e.nationality, e.birthplace,
       e.previous_grade_course_shift, e.gender, e.father_name, e.father_phone,
       e.father_cpf, e.mother_name, e.mother_phone, e.mother_cpf, e.lives_with,
       e.student_address, e.student_phone, e.guardian_name, e.guardian_relationship,
       e.siblings_in_daycare, e.siblings_details, e.new_student, e.origin_school,
       e.requested_class_id, e.requested_shift_id, e.contracted_hours,
       c.name AS class_name, s.name AS shift_name
  FROM enrollments e
  LEFT JOIN classes c ON c.id = e.requested_class_id
  LEFT JOIN shifts s ON s.id = e.requested_shift_id`;

try {
  db.prepare(createView).run();
  console.log("View vw_enrollments created!");
  
  // Testar view
  const result = db.prepare("SELECT id, year, student_name, class_name, shift_name FROM vw_enrollments LIMIT 2").all();
  console.log("Test:", JSON.stringify(result));
} catch (e) {
  console.log("Error creating view:", e.message);
}
