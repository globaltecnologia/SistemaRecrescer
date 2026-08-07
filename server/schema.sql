CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  login VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  school_year INTEGER,
  grade TEXT,
  education_level TEXT,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, school_year)
);

CREATE TABLE IF NOT EXISTS fathers (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT,
  residential_address TEXT,
  residential_number TEXT,
  residential_complement TEXT,
  residential_district TEXT,
  residential_city TEXT,
  residential_state TEXT,
  residential_zip TEXT,
  residential_phone TEXT,
  commercial_address TEXT,
  commercial_number TEXT,
  commercial_complement TEXT,
  commercial_district TEXT,
  commercial_city TEXT,
  commercial_state TEXT,
  commercial_zip TEXT,
  commercial_phone TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mothers (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT,
  residential_address TEXT,
  residential_number TEXT,
  residential_complement TEXT,
  residential_district TEXT,
  residential_city TEXT,
  residential_state TEXT,
  residential_zip TEXT,
  residential_phone TEXT,
  commercial_address TEXT,
  commercial_number TEXT,
  commercial_complement TEXT,
  commercial_district TEXT,
  commercial_city TEXT,
  commercial_state TEXT,
  commercial_zip TEXT,
  commercial_phone TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  registration VARCHAR(255) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  nationality TEXT,
  birthplace TEXT,
  grade TEXT,
  education_level TEXT,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  health_plan TEXT,
  blood_type TEXT,
  rh_factor TEXT,
  address TEXT,
  phone TEXT,
  fp TEXT,
  ff TEXT,
  scholarship TEXT,
  first_installment TEXT,
  pm TEXT,
  siblings_at_school TEXT,
  father_id INTEGER REFERENCES fathers(id) ON DELETE SET NULL,
  mother_id INTEGER REFERENCES mothers(id) ON DELETE SET NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year INTEGER NOT NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  birth_date TEXT,
  nationality TEXT,
  birthplace TEXT,
  previous_grade_course_shift TEXT,
  gender TEXT,
  father_name TEXT,
  father_phone TEXT,
  father_cpf TEXT,
  mother_name TEXT,
  mother_phone TEXT,
  mother_cpf TEXT,
  lives_with TEXT,
  student_address TEXT,
  student_phone TEXT,
  guardian_name TEXT,
  guardian_relationship TEXT,
  siblings_in_daycare INTEGER NOT NULL DEFAULT 0 CHECK (siblings_in_daycare IN (0, 1)),
  siblings_details TEXT,
  new_student INTEGER NOT NULL DEFAULT 1 CHECK (new_student IN (0, 1)),
  origin_school TEXT,
  requested_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  requested_shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  contracted_hours TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_records (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone TEXT,
  secondary_contact_name TEXT,
  secondary_contact_relationship TEXT,
  secondary_contact_phone TEXT,
  health_plan TEXT,
  emergency_hospital TEXT,
  measles INTEGER NOT NULL DEFAULT 0 CHECK (measles IN (0, 1)),
  chickenpox INTEGER NOT NULL DEFAULT 0 CHECK (chickenpox IN (0, 1)),
  mumps INTEGER NOT NULL DEFAULT 0 CHECK (mumps IN (0, 1)),
  rubella INTEGER NOT NULL DEFAULT 0 CHECK (rubella IN (0, 1)),
  pertussis INTEGER NOT NULL DEFAULT 0 CHECK (pertussis IN (0, 1)),
  other_common_diseases TEXT,
  allergies TEXT,
  fever_medication TEXT,
  tetanus_vaccine INTEGER NOT NULL DEFAULT 0 CHECK (tetanus_vaccine IN (0, 1)),
  tetanus_vaccine_date TEXT,
  respiratory_disease TEXT,
  neurological_disease TEXT,
  blood_type TEXT,
  rh_factor TEXT,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- View para listagem de matrículas com nomes legíveis
DROP VIEW IF EXISTS vw_enrollments;
CREATE VIEW vw_enrollments AS
SELECT e.id, e.year, e.student_name, e.birth_date, e.nationality, e.birthplace,
       e.previous_grade_course_shift, e.gender, e.father_name, e.father_phone,
       e.father_cpf, e.mother_name, e.mother_phone, e.mother_cpf, e.lives_with,
       e.student_address, e.student_phone, e.guardian_name, e.guardian_relationship,
       e.siblings_in_daycare, e.siblings_details, e.new_student, e.origin_school,
       e.requested_class_id, e.requested_shift_id, e.contracted_hours,
       c.name AS class_name, s.name AS shift_name
  FROM enrollments e
  LEFT JOIN classes c ON c.id = e.requested_class_id
  LEFT JOIN shifts s ON s.id = e.requested_shift_id;

DROP VIEW IF EXISTS vw_enrollment_forms;
CREATE VIEW vw_enrollment_forms AS
SELECT e.id, e.year, e.student_name,
       COALESCE(e.birth_date, st.birth_date) AS birth_date,
       COALESCE(e.nationality, st.nationality) AS nationality,
       COALESCE(e.birthplace, st.birthplace) AS birthplace,
       e.previous_grade_course_shift,
       COALESCE(e.gender, st.gender) AS gender,
       COALESCE(e.father_name, f.name) AS father_name,
       COALESCE(e.father_phone, f.residential_phone, f.commercial_phone) AS father_phone,
       COALESCE(e.father_cpf, f.cpf) AS father_cpf,
       COALESCE(e.mother_name, m.name) AS mother_name,
       COALESCE(e.mother_phone, m.residential_phone, m.commercial_phone) AS mother_phone,
       COALESCE(e.mother_cpf, m.cpf) AS mother_cpf,
       e.lives_with,
       COALESCE(e.student_address, st.address) AS student_address,
       COALESCE(e.student_phone, st.phone) AS student_phone,
       e.guardian_name, e.guardian_relationship,
       e.siblings_in_daycare, e.siblings_details, e.new_student, e.origin_school,
       c.name AS requested_class, c.education_level AS requested_education_level,
       s.name AS requested_shift, e.contracted_hours, st.notes AS observations
  FROM enrollments e
  LEFT JOIN students st ON st.id = e.student_id
  LEFT JOIN fathers f ON f.id = st.father_id
  LEFT JOIN mothers m ON m.id = st.mother_id
  LEFT JOIN classes c ON c.id = e.requested_class_id
  LEFT JOIN shifts s ON s.id = e.requested_shift_id;

-- Remove a view se existir (importante para atualizações)
DROP VIEW IF EXISTS vw_medical_forms;

CREATE VIEW vw_medical_forms AS
SELECT m.id, st.registration, st.name AS student_name,
       m.emergency_contact_name, m.emergency_contact_relationship,
       m.emergency_contact_phone, m.secondary_contact_name,
       m.secondary_contact_relationship, m.secondary_contact_phone,
       m.health_plan, m.emergency_hospital, m.measles, m.chickenpox,
       m.mumps, m.rubella, m.pertussis, m.other_common_diseases,
       m.allergies, m.fever_medication, m.tetanus_vaccine,
       m.tetanus_vaccine_date, m.respiratory_disease,
       m.neurological_disease, m.blood_type, m.rh_factor, m.notes,
       c.name AS class_name, s.name AS shift_name

  FROM medical_records m
  JOIN students st ON st.id = m.student_id
  LEFT JOIN classes c ON c.id = st.class_id
  LEFT JOIN shifts s ON s.id = COALESCE(st.shift_id, c.shift_id);

DROP VIEW IF EXISTS vw_attendance_list;
CREATE VIEW vw_attendance_list AS
SELECT c.school_year, c.id AS class_id, c.name AS class_name,
       s.name AS shift_name, st.registration, st.name AS student_name
  FROM students st
  JOIN classes c ON c.id = st.class_id
  LEFT JOIN shifts s ON s.id = COALESCE(st.shift_id, c.shift_id)
 WHERE st.active = 1
 ORDER BY c.name, st.name;

DROP VIEW IF EXISTS vw_students_by_class;
CREATE VIEW vw_students_by_class AS
SELECT c.school_year, c.id AS class_id, c.name AS class_name, c.grade,
       c.education_level, s.name AS shift_name,
       st.registration, st.name AS student_name, st.birth_date, st.gender
  FROM students st
  JOIN classes c ON c.id = st.class_id
  LEFT JOIN shifts s ON s.id = COALESCE(st.shift_id, c.shift_id)
 WHERE st.active = 1
 ORDER BY c.name, st.name;
