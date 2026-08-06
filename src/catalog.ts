import type { DynamicField } from "@alexandretorqueti/biblioteca-global-ui";
import type { UiRecord } from "./api";

export type PageKey =
  | "home"
  | "enrollments"
  | "students"
  | "fathers"
  | "mothers"
  | "medical_records"
  | "classes"
  | "shifts"
  | "users"
  | "report-enrollment"
  | "report-medical"
  | "report-attendance"
  | "report-students-class";

export interface EntityDefinition {
  resource: string;
  title: string;
  description: string;
  fields: (references: References) => DynamicField[];
  columnLabels?: Record<string, string>;
}

export interface References {
  shifts: UiRecord[];
  classes: UiRecord[];
  fathers: UiRecord[];
  mothers: UiRecord[];
  students: UiRecord[];
}

const text = (name: string, label: string, required = false): DynamicField => ({ name, label, type: "text", required });
const option = (row: UiRecord) => ({ label: String(row.name ?? row.student_name ?? row.id ?? ""), value: Number(row.id) });

const addressFields: DynamicField[] = [
  text("residential_address", "Endereço residencial"), text("residential_number", "Número"),
  text("residential_complement", "Complemento"), text("residential_district", "Bairro"),
  text("residential_city", "Cidade"), text("residential_state", "Estado"),
  text("residential_zip", "CEP"), text("residential_phone", "Telefone residencial"),
  text("commercial_address", "Endereço comercial"), text("commercial_number", "Número comercial"),
  text("commercial_complement", "Complemento comercial"), text("commercial_district", "Bairro comercial"),
  text("commercial_city", "Cidade comercial"), text("commercial_state", "Estado comercial"),
  text("commercial_zip", "CEP comercial"), text("commercial_phone", "Telefone comercial"),
];

export const entities: Partial<Record<PageKey, EntityDefinition>> = {
  shifts: {
    resource: "shifts", title: "Turnos", description: "Definição dos horários e turnos da escola.",
    fields: () => [text("name", "Nome do turno", true)],
  },
  classes: {
    resource: "classes", title: "Turmas", description: "Cadastro e gestão das turmas.",
    fields: ({ shifts }) => [
      text("name", "Nome da turma", true),
      { name: "school_year", label: "Ano letivo", type: "number" },
      text("grade", "Série"), text("education_level", "Ensino"),
      { name: "shift_id", label: "Turno", type: "select", options: shifts.map(option) },
    ],
  },
  fathers: {
    resource: "fathers", title: "Cadastro de Pais", description: "Dados pessoais, residenciais e comerciais dos pais.",
    fields: () => [text("name", "Nome", true), text("cpf", "CPF"), ...addressFields],
  },
  mothers: {
    resource: "mothers", title: "Cadastro de Mães", description: "Dados pessoais, residenciais e comerciais das mães.",
    fields: () => [text("name", "Nome", true), text("cpf", "CPF"), ...addressFields],
  },
  students: {
    resource: "students", title: "Cadastro de Alunos", description: "Cadastro completo e enturmação dos alunos.",
    fields: ({ classes, shifts, fathers, mothers }) => [
      text("registration", "Matrícula", true), text("name", "Nome", true),
      { name: "birth_date", label: "Nascimento", type: "date" },
      { name: "gender", label: "Sexo", type: "select", options: [{ label: "Masculino", value: "M" }, { label: "Feminino", value: "F" }, { label: "Outro", value: "O" }] },
      text("nationality", "Nacionalidade"), text("birthplace", "Naturalidade"), text("grade", "Série"), text("education_level", "Ensino"),
      { name: "class_id", label: "Turma", type: "select", options: classes.map(option) },
      { name: "shift_id", label: "Turno", type: "select", options: shifts.map(option) },
      text("health_plan", "Plano de saúde"), text("blood_type", "Tipo sanguíneo"), text("rh_factor", "Fator RH"),
      text("address", "Endereço completo"), text("phone", "Telefone(s)"), text("fp", "FP"), text("ff", "FF"),
      text("scholarship", "Bolsa"), text("first_installment", "Primeira cota"), text("pm", "PM"), text("siblings_at_school", "Irmãos no colégio"),
      { name: "father_id", label: "Pai", type: "select", options: fathers.map(option) },
      { name: "mother_id", label: "Mãe", type: "select", options: mothers.map(option) },
      { name: "notes", label: "Observações", type: "textarea", fullWidth: true },
      { name: "active", label: "Ativo", type: "boolean", defaultValue: true },
    ],
  },
  enrollments: {
    resource: "enrollments", title: "Ficha de Matrícula", description: "Requerimentos de novas matrículas.",
    fields: ({ students, classes, shifts }) => [
      { name: "year", label: "Ano", type: "number", required: true },
      { name: "student_id", label: "Aluno já cadastrado", type: "select", options: students.map(option) },
      text("student_name", "Nome do aluno", true), { name: "birth_date", label: "Nascimento", type: "date" },
      text("nationality", "Nacionalidade"), text("birthplace", "Naturalidade"), text("previous_grade_course_shift", "Série/Curso/Turno anterior"),
      { name: "gender", label: "Sexo", type: "select", options: [{ label: "Masculino", value: "M" }, { label: "Feminino", value: "F" }, { label: "Outro", value: "O" }] },
      text("father_name", "Nome do pai"), text("father_phone", "Telefone do pai"), text("father_cpf", "CPF do pai"),
      text("mother_name", "Nome da mãe"), text("mother_phone", "Telefone da mãe"), text("mother_cpf", "CPF da mãe"),
      { name: "lives_with", label: "Reside com", type: "select", options: [{ label: "Pais", value: "Pais" }, { label: "Pai", value: "Pai" }, { label: "Mãe", value: "Mãe" }, { label: "Responsável", value: "Responsável" }] },
      text("student_address", "Endereço do aluno"), text("student_phone", "Telefone do aluno"),
      text("guardian_name", "Responsável"), text("guardian_relationship", "Parentesco"),
      { name: "siblings_in_daycare", label: "Irmãos na creche", type: "boolean" },
      text("siblings_details", "Dados dos irmãos"), { name: "new_student", label: "Aluno novo", type: "boolean", defaultValue: true },
      text("origin_school", "Escola de origem"),
      { name: "requested_class_id", label: "Turma requerida", type: "select", options: classes.map(option) },
      { name: "requested_shift_id", label: "Turno requerido", type: "select", options: shifts.map(option) },
      text("contracted_hours", "Horas contratadas"),
    ],
  },
  medical_records: {
    resource: "medical_records", title: "Ficha Médica", description: "Dados médicos e contatos de emergência dos alunos.",
    fields: ({ students }) => [
      { name: "student_id", label: "Aluno", type: "select", required: true, options: students.map(option) },
      text("emergency_contact_name", "Contato de emergência"), text("emergency_contact_relationship", "Parentesco"), text("emergency_contact_phone", "Telefone"),
      text("secondary_contact_name", "Segundo contato"), text("secondary_contact_relationship", "Parentesco do segundo contato"), text("secondary_contact_phone", "Telefone do segundo contato"),
      text("health_plan", "Plano de saúde"), text("emergency_hospital", "Hospital de emergência"),
      { name: "measles", label: "Sarampo", type: "boolean" }, { name: "chickenpox", label: "Catapora", type: "boolean" },
      { name: "mumps", label: "Caxumba", type: "boolean" }, { name: "rubella", label: "Rubéola", type: "boolean" },
      { name: "pertussis", label: "Coqueluche", type: "boolean" }, text("other_common_diseases", "Outras doenças comuns"),
      text("allergies", "Alergias"), text("fever_medication", "Medicação para febre"),
      { name: "tetanus_vaccine", label: "Vacina antitetânica", type: "boolean" },
      { name: "tetanus_vaccine_date", label: "Data da vacina", type: "date" },
      text("respiratory_disease", "Doença respiratória"), text("neurological_disease", "Doença neurológica"),
      text("blood_type", "Tipo sanguíneo"), text("rh_factor", "Fator RH"),
      { name: "notes", label: "Observações", type: "textarea", fullWidth: true },
    ],
  },
};

export const reports = {
  "report-enrollment": { endpoint: "enrollment-form", title: "Relatório - Ficha de Matrícula" },
  "report-medical": { endpoint: "medical-form", title: "Relatório - Ficha Médica" },
  "report-attendance": { endpoint: "attendance-list", title: "Lista de Presença" },
  "report-students-class": { endpoint: "students-by-class", title: "Alunos por Turma" },
} satisfies Partial<Record<PageKey, { endpoint: string; title: string }>>;
