-- Migration 001 — Remover colunas redundantes de enrollments
-- Executar antes do deploy da API atualizada.
-- Em produção: rodar via "npm run migrate" no servidor ou CLI.
-- Todas as colunas removidas são obtidas por JOIN nas views existentes.

-- Colunas redundantes do aluno (já vindas via students):
-- student_name, birth_date, nationality, birthplace, gender,
-- student_address (→ students.address), student_phone (→ students.phone)
-- Colunas redundantes dos pais (já vindas via students → fathers/mothers):
-- father_name, father_phone, father_cpf, mother_name, mother_phone, mother_cpf

-- Lista de colunas que NÃO serão removidas:
-- id, year, student_id, previous_grade_course_shift,
-- lives_with, guardian_name, guardian_relationship,
-- siblings_in_daycare, siblings_details, new_student, origin_school,
-- requested_class_id, requested_shift_id, contracted_hours,
-- created_at, updated_at

ALTER TABLE `enrollments`
  DROP COLUMN `student_name`,
  DROP COLUMN `birth_date`,
  DROP COLUMN `nationality`,
  DROP COLUMN `birthplace`,
  DROP COLUMN `gender`,
  DROP COLUMN `student_address`,
  DROP COLUMN `student_phone`,
  DROP COLUMN `father_name`,
  DROP COLUMN `father_phone`,
  DROP COLUMN `father_cpf`,
  DROP COLUMN `mother_name`,
  DROP COLUMN `mother_phone`,
  DROP COLUMN `mother_cpf`;

-- A view vw_enrollment_forms já usa COALESCE(st.*, f.*, m.*) — funcionará sem ajustes.
-- A view vw_enrollments precisa ser recriada (sem colunas removidas).

DROP VIEW IF EXISTS vw_enrollments;
CREATE VIEW vw_enrollments AS
SELECT e.id, e.year, e.student_id, e.previous_grade_course_shift, e.lives_with,
       e.guardian_name, e.guardian_relationship, e.siblings_in_daycare, e.siblings_details,
       e.new_student, e.origin_school, e.requested_class_id, e.requested_shift_id,
       e.contracted_hours, st.name AS student_name, st.birth_date, st.nationality, st.birthplace, st.gender,
       c.name AS class_name, s.name AS shift_name
  FROM enrollments e
  LEFT JOIN students st ON st.id = e.student_id
  LEFT JOIN classes c ON c.id = e.requested_class_id
  LEFT JOIN shifts s ON s.id = e.requested_shift_id;
