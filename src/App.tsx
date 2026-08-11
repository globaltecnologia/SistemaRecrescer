import { useEffect, useMemo, useState, useRef, useCallback, type FormEvent, type MouseEvent } from "react";
import {
  AuthPanel,
  Cadastro,
  JsonGrid,

  type AuthValues,
} from "@alexandretorqueti/biblioteca-global-ui";
import {
  createDataSource,
  createUser,
  currentUser,
  deleteUser,
  hasStoredToken,
  listRecords,
  listReport,
  login,
  logout,
  updateUser,
  type SessionUser,
  type UiRecord,
  createCompleteEnrollment,
  type EnrollmentPayload,
} from "./api";
import { entities, reports, type PageKey, type References } from "./catalog";
import "./App.css";

const emptyReferences: References = { shifts: [], classes: [], fathers: [], mothers: [], students: [] };

const menu = [
  {
    label: "Cadastros",
    items: [
      ["enrollments", "Ficha de Matrícula"], ["students", "Alunos"], ["fathers", "Pais"],
      ["mothers", "Mães"], ["medical_records", "Ficha Médica"],
    ],
  },
  {
    label: "Relatórios",
    items: [
      ["report-enrollment", "Ficha de Matrícula"], ["report-medical", "Ficha Médica"],
      ["report-attendance", "Lista de Presença"], ["report-students-class", "Alunos por Turma"],
    ],
  },
  {
    label: "Administração",
    items: [["classes", "Turmas"], ["shifts", "Turnos"], ["users", "Usuários Administrativos"]],
  },
] satisfies { label: string; items: [PageKey, string][] }[];

function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return <div className="error-notice" role="alert">{message}</div>;
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [error, setError] = useState("");

  const handleLogin = async (values: AuthValues) => {
    setError("");
    try {
      const result = await login(String(values.identifier ?? ""), String(values.password ?? ""));
      onAuthenticated(result.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
      throw loginError;
    }
  };

  return (
    <main className="login-page">
      <div className="login-box">
        <ErrorNotice message={error} />
        <AuthPanel
          config={{
            appName: "Sistema Recrescer",
            title: "Acesso administrativo",
            subtitle: "Informe seu login e senha",
            loginIdentifier: "username",
            customIdentifierLabel: "Login",
            registrationFields: [],
            allowRegistration: false,
            allowPasswordRecovery: false,
            allowRememberMe: false,
            socialProviders: [],
            loginButtonLabel: "Entrar",
          }}
          onLogin={handleLogin}
        />
      </div>
    </main>
  );
}

// --- Helper para obter dados do pai a partir da lista de pais ---
function findFatherById(list: UiRecord[], id?: number | null): UiRecord | undefined {
  if (!id) return undefined;
  return list.find(r => String(r.id) === String(id));
}

function findMotherById(list: UiRecord[], id?: number | null): UiRecord | undefined {
  if (!id) return undefined;
  return list.find(r => String(r.id) === String(id));
}

// --- Seção: Pai (Autocomplete + campos editáveis) ---
function FatherSection({ fathers, value, onChange }: {
  fathers: UiRecord[];
  value: Partial<UiRecord>;
  onChange: (updates: Partial<UiRecord>) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [filtered, setFiltered] = useState<UiRecord[]>(fathers);
  
  ;

  const hasSelection = value.id && Number(value.id) > 0;

  useEffect(() => {
    // Se já tem seleção válida, mostrar nome no campo de busca
    if (hasSelection) {
      const sel = findFatherById(fathers, Number(value.id));
      if (sel) setSearchText(String(sel.name ?? ""));
    } else {
      setSearchText("");
    }
  }, [value?.id, fathers]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null!);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!searchText) { setFiltered(fathers); return; }
    
    debounceRef.current = setTimeout(() => {
      const q = searchText.toLowerCase();
      setFiltered(fathers.filter(r => (String(r.name ?? "") + " " + String(r.cpf ?? "")).toLowerCase().includes(q)));
      
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [searchText, fathers]);

  const handleSelect = (student: UiRecord | null) => {
    if (!student) {
      // Desseleção — limpar todos os campos do pai
      onChange({ id: undefined, name: "", cpf: "", residential_address: "", residential_number: "", residential_complement: "", residential_district: "", residential_city: "", residential_state: "", residential_zip: "", residential_phone: "", commercial_address: "", commercial_number: "", commercial_complement: "", commercial_district: "", commercial_city: "", commercial_state: "", commercial_zip: "", commercial_phone: "" });
      setSearchText("");
    } else {
      onChange({ id: student.id, name: student.name, cpf: student.cpf, residential_address: student.residential_address, residential_number: student.residential_number, residential_complement: student.residential_complement, residential_district: student.residential_district, residential_city: student.residential_city, residential_state: student.residential_state, residential_zip: student.residential_zip, residential_phone: student.residential_phone, commercial_address: student.commercial_address, commercial_number: student.commercial_number, commercial_complement: student.commercial_complement, commercial_district: student.commercial_district, commercial_city: student.commercial_city, commercial_state: student.commercial_state, commercial_zip: student.commercial_zip, commercial_phone: student.commercial_phone });
      setSearchText(String(student.name ?? ""));
    }
  };

  const handleChange = (field: string, val: any) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <legend style={{ fontWeight: 600, fontSize: 14 }}>👨 Pai</legend>
      {/* Campo nome com Autocomplete simulado (select + texto editável) */}
      <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Nome do pai</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={searchText}
          onChange={e => { setSearchText(e.target.value); if (hasSelection && e.target.value !== String(value.name ?? "")) handleSelect(null); }}
          placeholder="Buscar ou digitar novo..."
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4 }}
        />
        <button type="button" onClick={() => handleSelect(null)} title="Limpar seleção" style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}>✕</button>
      </div>
      {/* Dropdown de sugestões */}
      {searchText && filtered.length > 0 && (
        <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #ccc", borderRadius: 4, marginBottom: 12, background: "#fff" }}>
          {filtered.map(r => (
            <div key={String(r.id)} onClick={() => handleSelect(r)} style={{ padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #eee" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0f4ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              {String(r.name ?? "")} — {String(r.cpf || "")}
            </div>
          ))}
        </div>
      )}
      {/* Campos editáveis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>CPF</span><input type="text" value={String(value.cpf ?? "")} onChange={e => handleChange("cpf", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Tel. Residencial</span><input type="text" value={String(value.residential_phone ?? "")} onChange={e => handleChange("residential_phone", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Tel. Comercial</span><input type="text" value={String(value.commercial_phone ?? "")} onChange={e => handleChange("commercial_phone", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Endereço</span><input type="text" value={String(value.residential_address ?? "")} onChange={e => handleChange("residential_address", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Número</span><input type="text" value={String(value.residential_number ?? "")} onChange={e => handleChange("residential_number", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Complemento</span><input type="text" value={String(value.residential_complement ?? "")} onChange={e => handleChange("residential_complement", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Bairro</span><input type="text" value={String(value.residential_district ?? "")} onChange={e => handleChange("residential_district", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Cidade</span><input type="text" value={String(value.residential_city ?? "")} onChange={e => handleChange("residential_city", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Estado</span><input type="text" value={String(value.residential_state ?? "")} onChange={e => handleChange("residential_state", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>CEP</span><input type="text" value={String(value.residential_zip ?? "")} onChange={e => handleChange("residential_zip", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
      </div>
    </fieldset>
  );
}

// --- Seção: Mãe (Autocomplete + campos editáveis) ---
function MotherSection({ mothers, value, onChange }: {
  mothers: UiRecord[];
  value: Partial<UiRecord>;
  onChange: (updates: Partial<UiRecord>) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [filtered, setFiltered] = useState<UiRecord[]>(mothers);
  
  ;

  const hasSelection = value.id && Number(value.id) > 0;

  useEffect(() => {
    if (hasSelection) {
      const sel = findMotherById(mothers, Number(value.id));
      if (sel) setSearchText(String(sel.name ?? ""));
    } else {
      setSearchText("");
    }
  }, [value?.id, mothers]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null!);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!searchText) { setFiltered(mothers); return; }
    
    debounceRef.current = setTimeout(() => {
      const q = searchText.toLowerCase();
      setFiltered(mothers.filter(r => (String(r.name ?? "") + " " + String(r.cpf ?? "")).toLowerCase().includes(q)));
      
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [searchText, mothers]);

  const handleSelect = (student: UiRecord | null) => {
    if (!student) {
      onChange({ id: undefined, name: "", cpf: "", residential_address: "", residential_number: "", residential_complement: "", residential_district: "", residential_city: "", residential_state: "", residential_zip: "", residential_phone: "", commercial_address: "", commercial_number: "", commercial_complement: "", commercial_district: "", commercial_city: "", commercial_state: "", commercial_zip: "", commercial_phone: "" });
      setSearchText("");
    } else {
      onChange({ id: student.id, name: student.name, cpf: student.cpf, residential_address: student.residential_address, residential_number: student.residential_number, residential_complement: student.residential_complement, residential_district: student.residential_district, residential_city: student.residential_city, residential_state: student.residential_state, residential_zip: student.residential_zip, residential_phone: student.residential_phone, commercial_address: student.commercial_address, commercial_number: student.commercial_number, commercial_complement: student.commercial_complement, commercial_district: student.commercial_district, commercial_city: student.commercial_city, commercial_state: student.commercial_state, commercial_zip: student.commercial_zip, commercial_phone: student.commercial_phone });
      setSearchText(String(student.name ?? ""));
    }
  };

  const handleChange = (field: string, val: any) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <legend style={{ fontWeight: 600, fontSize: 14 }}>👩 Mãe</legend>
      <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Nome da mãe</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={searchText}
          onChange={e => { setSearchText(e.target.value); if (hasSelection && e.target.value !== String(value.name ?? "")) handleSelect(null); }}
          placeholder="Buscar ou digitar novo..."
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4 }}
        />
        <button type="button" onClick={() => handleSelect(null)} title="Limpar seleção" style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}>✕</button>
      </div>
      {searchText && filtered.length > 0 && (
        <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #ccc", borderRadius: 4, marginBottom: 12, background: "#fff" }}>
          {filtered.map(r => (
            <div key={String(r.id)} onClick={() => handleSelect(r)} style={{ padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #eee" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0f4ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              {String(r.name ?? "")} — {String(r.cpf || "")}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>CPF</span><input type="text" value={String(value.cpf ?? "")} onChange={e => handleChange("cpf", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Tel. Residencial</span><input type="text" value={String(value.residential_phone ?? "")} onChange={e => handleChange("residential_phone", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Tel. Comercial</span><input type="text" value={String(value.commercial_phone ?? "")} onChange={e => handleChange("commercial_phone", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Endereço</span><input type="text" value={String(value.residential_address ?? "")} onChange={e => handleChange("residential_address", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Número</span><input type="text" value={String(value.residential_number ?? "")} onChange={e => handleChange("residential_number", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Complemento</span><input type="text" value={String(value.residential_complement ?? "")} onChange={e => handleChange("residential_complement", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Bairro</span><input type="text" value={String(value.residential_district ?? "")} onChange={e => handleChange("residential_district", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Cidade</span><input type="text" value={String(value.residential_city ?? "")} onChange={e => handleChange("residential_city", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>Estado</span><input type="text" value={String(value.residential_state ?? "")} onChange={e => handleChange("residential_state", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
        <label><span style={{ fontWeight: 500, fontSize: 12 }}>CEP</span><input type="text" value={String(value.residential_zip ?? "")} onChange={e => handleChange("residential_zip", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} /></label>
      </div>
    </fieldset>
  );
}

// --- Campo Autocomplete de Aluno integrado ao formulário ---
function StudentAutocomplete({ students, fathers, mothers, value, onChange }: {
  students: UiRecord[];
  classes: UiRecord[];
  shifts: UiRecord[];
  fathers: UiRecord[];
  mothers: UiRecord[];
  value: Partial<UiRecord> & { father?: Partial<UiRecord>; mother?: Partial<UiRecord> };
  onChange: (updates: Partial<UiRecord>, studentUpdates?: Partial<UiRecord>, fatherUpdates?: Partial<UiRecord>, motherUpdates?: Partial<UiRecord>) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [filtered, setFiltered] = useState<UiRecord[]>(students);
  
  ;

  const hasSelection = value.id && Number(value.id) > 0;

  // Buscar/limpar ao selecionar/deselecionar aluno existente
  useEffect(() => {
    if (hasSelection) {
      const sel = students.find(r => String(r.id) === String(value.id));
      if (sel) setSearchText(String(sel.student_name ?? sel.name ?? ""));
    } else {
      setSearchText("");
    }
  }, [value?.id, students]);

  // Filtrar alunos conforme digitação
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null!);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!searchText) { setFiltered(students); return; }
    
    debounceRef.current = setTimeout(() => {
      const q = searchText.toLowerCase();
      setFiltered(students.filter(r => (String(r.student_name ?? r.name ?? "")).toLowerCase().includes(q)));
      
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [searchText, students]);

  const handleSelect = (student: UiRecord | null) => {
    if (!student) {
      // Desseleção: limpar campos do aluno + resetar pai/mãe ao estado vazio
      onChange({
        id: undefined, name: "", birth_date: "", nationality: "", birthplace: "",
        grade: "", education_level: "", address: "", phone: "", fp: "", ff: "",
        scholarship: "", first_installment: "", pm: "", siblings_at_school: "",
        notes: "", active: true, gender: "", class_id: "", shift_id: "", health_plan: "", blood_type: "", rh_factor: "",
        father: { id: undefined, name: "", cpf: "", residential_address: "", residential_number: "", residential_complement: "", residential_district: "", residential_city: "", residential_state: "", residential_zip: "", residential_phone: "", commercial_address: "", commercial_number: "", commercial_complement: "", commercial_district: "", commercial_city: "", commercial_state: "", commercial_zip: "", commercial_phone: "" },
        mother: { id: undefined, name: "", cpf: "", residential_address: "", residential_number: "", residential_complement: "", residential_district: "", residential_city: "", residential_state: "", residential_zip: "", residential_phone: "", commercial_address: "", commercial_number: "", commercial_complement: "", commercial_district: "", commercial_city: "", commercial_state: "", commercial_zip: "", commercial_phone: "" },
      });
      setSearchText("");
    } else {
      // Auto-preenchimento: aluno + pai/mãe vinculados
      const fatherRef = findFatherById(fathers, (student as any).father_id);
      const motherRef = findMotherById(mothers, (student as any).mother_id);

      onChange(
        {
          id: student.id, name: student.student_name ?? student.name, birth_date: student.birth_date, nationality: student.nationality,
          birthplace: student.birthplace, grade: student.grade, education_level: student.education_level,
          address: student.address, phone: student.phone, fp: student.fp, ff: student.ff,
          scholarship: student.scholarship, first_installment: student.first_installment, pm: student.pm,
          siblings_at_school: student.siblings_at_school, notes: student.notes, active: (student.active !== false && student.active !== 0), gender: student.gender, class_id: student.class_id, shift_id: student.shift_id, health_plan: student.health_plan, blood_type: student.blood_type, rh_factor: student.rh_factor,
        },
        {
          id: student.id, name: student.student_name ?? student.name, birth_date: student.birth_date, nationality: student.nationality, birthplace: student.birthplace, grade: student.grade, education_level: student.education_level, address: student.address, phone: student.phone, fp: student.fp, ff: student.ff, scholarship: student.scholarship, first_installment: student.first_installment, pm: student.pm, siblings_at_school: student.siblings_at_school, notes: student.notes, active: (student.active !== false && student.active !== 0), gender: student.gender, class_id: student.class_id, shift_id: student.shift_id, health_plan: student.health_plan, blood_type: student.blood_type, rh_factor: student.rh_factor,
        },
        // father data
        fatherRef ? { id: fatherRef.id, name: fatherRef.name, cpf: fatherRef.cpf, residential_address: fatherRef.residential_address, residential_number: fatherRef.residential_number, residential_complement: fatherRef.residential_complement, residential_district: fatherRef.residential_district, residential_city: fatherRef.residential_city, residential_state: fatherRef.residential_state, residential_zip: fatherRef.residential_zip, residential_phone: fatherRef.residential_phone, commercial_address: fatherRef.commercial_address, commercial_number: fatherRef.commercial_number, commercial_complement: fatherRef.commercial_complement, commercial_district: fatherRef.commercial_district, commercial_city: fatherRef.commercial_city, commercial_state: fatherRef.commercial_state, commercial_zip: fatherRef.commercial_zip, commercial_phone: fatherRef.commercial_phone } : undefined,
        // mother data
        motherRef ? { id: motherRef.id, name: motherRef.name, cpf: motherRef.cpf, residential_address: motherRef.residential_address, residential_number: motherRef.residential_number, residential_complement: motherRef.residential_complement, residential_district: motherRef.residential_district, residential_city: motherRef.residential_city, residential_state: motherRef.residential_state, residential_zip: motherRef.residential_zip, residential_phone: motherRef.residential_phone, commercial_address: motherRef.commercial_address, commercial_number: motherRef.commercial_number, commercial_complement: motherRef.commercial_complement, commercial_district: motherRef.commercial_district, commercial_city: motherRef.commercial_city, commercial_state: motherRef.commercial_state, commercial_zip: motherRef.commercial_zip, commercial_phone: motherRef.commercial_phone } : undefined
      );
      setSearchText(String(student.student_name ?? student.name ?? ""));
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>👤 Aluno</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={searchText}
          onChange={e => {
            const t = e.target.value;
            setSearchText(t);
            if (hasSelection) handleSelect(null);
            // Sincronizar o nome digitado para o estado do aluno (novo ou existente)
            if (t !== String(value.name ?? "")) {
              onChange({ ...(value as any), name: t });
            }
          }}
          placeholder="Buscar aluno ou digitar nome para novo..."
          style={{ flex: 1, padding: "8px 12px", border: "2px solid #4a90d9", borderRadius: 4, fontSize: 15 }}
        />
        {hasSelection && (
          <button type="button" onClick={() => handleSelect(null)} title="Limpar seleção do aluno" style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", background: "#f9f9f9" }}>✕</button>
        )}
      </div>
      {searchText && filtered.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #4a90d9", borderRadius: 4, marginBottom: 8, background: "#fff" }}>
          {filtered.map(r => (
            <div key={String(r.id)} onClick={() => handleSelect(r)} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #eee" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e8f0fe")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <strong>{String(r.student_name ?? r.name)}</strong> {r.registration ? `— ${String(r.registration)}` : ""}
            </div>
          ))}
        </div>
      )}
      {searchText && filtered.length === 0 && (
        <div style={{ color: "#666", fontSize: 13, fontStyle: "italic" }}>Nenhum aluno encontrado — preencha os dados abaixo para criar um novo.</div>
      )}
    </div>
  );
}

// --- Componente principal da Ficha de Matrícula ---
function EnrollmentsPage({ references }: { references: References }) {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [studentData, setStudentData] = useState<Partial<UiRecord>>({ active: true });
  const [fatherData, setFatherData] = useState<Partial<UiRecord>>({});
  const [motherData, setMotherData] = useState<Partial<UiRecord>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  

  // Atualiza estado de aluno + pai/mãe de uma vez (chamado pelo StudentAutocomplete)
  const handleStudentChange = useCallback((updates: Partial<UiRecord>, studentUpdates?: Partial<UiRecord>, fatherUpdates?: Partial<UiRecord>, motherUpdates?: Partial<UiRecord>) => {
    if (studentUpdates) {
      setStudentData(studentUpdates);
    } else if (updates && Object.keys(updates).length) {
      // Sem studentUpdates dedicado — aplicar updates ao studentData (ex.: nome digitado).
      // Remover sub-objetos father/mother para não espalhar dentro de studentData.
      const { father, mother, ...studentOnly } = updates as any;
      setStudentData(prev => ({ ...prev, ...studentOnly }));
    }
    if (fatherUpdates !== undefined) setFatherData(fatherUpdates);
    if (motherUpdates !== undefined) setMotherData(motherUpdates);
    // Atualizar também formValues pra campos que podem ser editados manualmente depois
    if (updates.name && studentData.name !== updates.name) setFormValues(prev => ({ ...prev, name: updates.name }));
  }, [studentData.name]);

  const handleStudentFieldChange = useCallback((field: string, value: any) => {
    setStudentData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleEnrollmentFieldChange = useCallback((field: string, value: any) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  }, []);

  // Campos que vão para students vs enrollments table
  const studentFields = new Set(["gender", "nationality", "birthplace", "birth_date"]);
  const isStudentField = (f: string) => studentFields.has(f);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Separar campos do aluno vs matrícula dos formValues
    const studentFromForm: Record<string, any> = {};
    const enrollmentFromForm: Record<string, any> = {};
    for (const [key, val] of Object.entries(formValues)) {
      if (val === undefined || val === "") continue;
      if (isStudentField(key) || key === "name" || key === "address" || key === "phone" || key === "registration") {
        studentFromForm[key] = val;
      } else {
        enrollmentFromForm[key] = val;
      }
    }

    try {
      const studentPayload = { ...studentData, ...studentFromForm };

      // Gerar registration automático se é aluno novo e não tem
      if (!studentPayload.id && !studentPayload.registration && studentPayload.name) {
        const now = new Date();
        studentPayload.registration = `REC-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*9999)).padStart(4,"0")}`;
      }

      const payload: EnrollmentPayload = {
        student: studentPayload,
        enrollment: enrollmentFromForm,
      };

      // Incluir pai se houver dados significativos (nome ou id)
      if (fatherData.name || fatherData.id) {
        payload.father = fatherData;
      }
      // Incluir mãe se houver dados significativos
      if (motherData.name || motherData.id) {
        payload.mother = motherData;
      }

      await createCompleteEnrollment(payload);

      // Limpar formulário após sucesso
      setStudentData({ active: true });
      setFatherData({});
      setMotherData({});
      setFormValues({});
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Falha ao salvar matrícula.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>Ficha de Matrícula</h2>
          <p>Selecione um aluno existente ou digite os dados para criar um novo. Todos os campos são editáveis.</p>
        </div>
      </div>

      <ErrorNotice message={error} />

      {loading && <div className="error-notice" role="alert">Salvando...</div>}

      <form onSubmit={handleSubmit}>
        {/* Campo aluno com Autocomplete */}
        <StudentAutocomplete
          students={references.students}
          classes={references.classes}
          shifts={references.shifts}
          fathers={references.fathers}
          mothers={references.mothers}
          value={{ ...studentData, father: fatherData, mother: motherData }}
          onChange={handleStudentChange}
        />

        {/* Seções Pai e Mãe */}
        <FatherSection
          fathers={references.fathers}
          value={fatherData}
          onChange={setFatherData}
        />
        <MotherSection
          mothers={references.mothers}
          value={motherData}
          onChange={setMotherData}
        />

        {/* Separador visual */}
        <div style={{ borderTop: "2px solid #4a90d9", margin: "20px 0" }} />

        {/* Dados da matrícula */}
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>📋 Dados da Matrícula</h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          {/* Ano */}
          <label>
            <span style={{ fontWeight: 500 }}>Ano *</span>
            <input type="number" required value={String(formValues.year ?? "")} onChange={e => handleEnrollmentFieldChange("year", e.target.value ? Number(e.target.value) : "")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Sexo */}
          <label>
            <span style={{ fontWeight: 500 }}>Sexo</span>
            <select value={formValues.gender ?? ""} onChange={e => handleStudentFieldChange("gender", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}>
              <option value="">Selecione...</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </label>

          {/* Turma requerida */}
          <label>
            <span style={{ fontWeight: 500 }}>Turma requerida</span>
            <select value={String(formValues.requested_class_id ?? "")} onChange={e => handleEnrollmentFieldChange("requested_class_id", e.target.value ? Number(e.target.value) : "")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}>
              <option value="">Selecione...</option>
              {references.classes.map((r: UiRecord) => (
                <option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>
              ))}
            </select>
          </label>

          {/* Turno requerido */}
          <label>
            <span style={{ fontWeight: 500 }}>Turno requerido</span>
            <select value={String(formValues.requested_shift_id ?? "")} onChange={e => handleEnrollmentFieldChange("requested_shift_id", e.target.value ? Number(e.target.value) : "")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}>
              <option value="">Selecione...</option>
              {references.shifts.map((r: UiRecord) => (
                <option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>
              ))}
            </select>
          </label>

          {/* Carga horária */}
          <label>
            <span style={{ fontWeight: 500 }}>Carga horária</span>
            <input type="text" value={String(formValues.contracted_hours ?? "")} onChange={e => handleEnrollmentFieldChange("contracted_hours", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Irmão na creche */}
          <label>
            <span style={{ fontWeight: 500 }}>Irmão na creche</span>
            <select value={String(formValues.siblings_in_daycare ?? "")} onChange={e => handleEnrollmentFieldChange("siblings_in_daycare", e.target.value ? Number(e.target.value) : "")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}>
              <option value="">Selecione...</option>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </label>

          {/* Novo aluno */}
          <label>
            <span style={{ fontWeight: 500 }}>Novo aluno?</span>
            <select value={String(formValues.new_student ?? "")} onChange={e => handleEnrollmentFieldChange("new_student", e.target.value ? Number(e.target.value) : "")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}>
              <option value="">Selecione...</option>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </label>

          {/* Escola de origem */}
          <label>
            <span style={{ fontWeight: 500 }}>Escola de origem</span>
            <input type="text" value={String(formValues.origin_school ?? "")} onChange={e => handleEnrollmentFieldChange("origin_school", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Mora com */}
          <label>
            <span style={{ fontWeight: 500 }}>Mora com</span>
            <input type="text" value={String(formValues.lives_with ?? "")} onChange={e => handleEnrollmentFieldChange("lives_with", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Nome do responsável */}
          <label>
            <span style={{ fontWeight: 500 }}>Nome do responsável</span>
            <input type="text" value={String(formValues.guardian_name ?? "")} onChange={e => handleEnrollmentFieldChange("guardian_name", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Grau de parentesco */}
          <label>
            <span style={{ fontWeight: 500 }}>Grau de parentesco</span>
            <input type="text" value={String(formValues.guardian_relationship ?? "")} onChange={e => handleEnrollmentFieldChange("guardian_relationship", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Detalhes dos irmãos */}
          <label>
            <span style={{ fontWeight: 500 }}>Detalhes dos irmãos</span>
            <input type="text" value={String(formValues.siblings_details ?? "")} onChange={e => handleEnrollmentFieldChange("siblings_details", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Série anterior */}
          <label>
            <span style={{ fontWeight: 500 }}>Série/Curso/Turno anterior</span>
            <input type="text" value={String(formValues.previous_grade_course_shift ?? "")} onChange={e => handleEnrollmentFieldChange("previous_grade_course_shift", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Nacionalidade */}
          <label>
            <span style={{ fontWeight: 500 }}>Nacionalidade</span>
            <input type="text" value={String(formValues.nationality ?? "")} onChange={e => handleStudentFieldChange("nationality", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Naturalidade */}
          <label>
            <span style={{ fontWeight: 500 }}>Naturalidade</span>
            <input type="text" value={String(formValues.birthplace ?? "")} onChange={e => handleStudentFieldChange("birthplace", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>

          {/* Data de nascimento */}
          <label>
            <span style={{ fontWeight: 500 }}>Data de nascimento</span>
            <input type="date" value={String(formValues.birth_date ?? "")} onChange={e => handleStudentFieldChange("birth_date", e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
          </label>
        </div>

        {/* Botão salvar */}
        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Salvando..." : "Salvar Matrícula"}
          </button>
        </div>
      </form>

      {/* Lista de matrículas existentes */}
      <EnrollmentGrid />
    </section>
  );
}

// --- Grid de matrículas existentes (leitura + impressão) ---
function EnrollmentGrid() {
  const [rows, setRows] = useState<UiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listRecords("enrollments")
      .then(data => { if (active) setRows(data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (rows.length === 0 && loading) return <div>Carregando matrículas...</div>;

  return (
    <section style={{ marginTop: 32 }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>📋 Matrículas existentes</h3>
      <JsonGrid
        data={rows} loading={loading}
        hiddenColumns={["id", "created_at", "updated_at"]}
        columnLabels={{ year: "Ano", student_name: "Aluno" }}
      />
    </section>
  );
}

function EntityPage({ page, references }: { page: PageKey; references: References }) {
  const definition = entities[page];
  const resource = definition?.resource ?? "";
  const dataSource = useMemo(() => createDataSource(resource), [resource]);
  if (!definition) return null;

  // Configurações específicas por entidade
  let hiddenColumns = ["id", "created_at", "updated_at"];
  let columnLabels: Record<string, string> = {};

  if (page === "students") {
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "birth_date", "gender", "nationality", "birthplace",
      "education_level", "class_id", "shift_id",
      "health_plan", "blood_type", "rh_factor", "address", "phone",
      "fp", "ff", "scholarship", "first_installment", "pm", "siblings_at_school",
      "father_id", "mother_id", "notes", "active"
    ];
    columnLabels = {
      registration: "Matrícula",
      grade: "Série",
      name: "Nome do Aluno"
    };
  }

  if (page === "mothers") {
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "cpf",
      "residential_address", "residential_number", "residential_complement",
      "residential_district", "residential_city", "residential_state",
      "residential_zip",
      "commercial_address", "commercial_number", "commercial_complement",
      "commercial_district", "commercial_city", "commercial_state",
      "commercial_zip"
    ];
    columnLabels = {
      name: "Nome da Mãe",
      residential_phone: "Telefone Residencial",
      commercial_phone: "Telefone Comercial"
    };
  }

  if (page === "medical_records") {
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "student_id",
      "emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone",
      "secondary_contact_name", "secondary_contact_relationship", "secondary_contact_phone",
      "health_plan", "emergency_hospital",
      "measles", "chickenpox", "mumps", "rubella", "pertussis",
      "other_common_diseases", "allergies", "fever_medication",
      "tetanus_vaccine", "tetanus_vaccine_date",
      "respiratory_disease", "neurological_disease",
      "blood_type", "rh_factor", "notes"
    ];
    columnLabels = {
      student_name: "Nome do aluno"
    };
  }

  if (page === "fathers") {
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "cpf",
      "residential_address", "residential_number", "residential_complement",
      "residential_district", "residential_city", "residential_state",
      "residential_zip",
      "commercial_address", "commercial_number", "commercial_complement",
      "commercial_district", "commercial_city", "commercial_state",
      "commercial_zip"
    ];
    columnLabels = {
      name: "Nome do Pai",
      residential_phone: "Telefone Residencial",
      commercial_phone: "Telefone Comercial"
    };
  }

  return (
    <Cadastro
      title={definition.title}
      description={definition.description}
      fields={definition.fields(references)}
      dataSource={dataSource}
      columns={2}
      hiddenColumns={hiddenColumns}
      columnLabels={columnLabels}
      newLabel="Novo registro"
    />
  );
}

function reportValue(value: UiRecord[string]) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function reportGridValue(value: UiRecord[string]) {
  if (value === null || value === undefined) return "Nulo";
  return reportValue(value);
}

function reportDate(value: UiRecord[string]) {
  const raw = reportValue(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}

function reportGender(value: UiRecord[string]) {
  const gender = reportValue(value).toUpperCase();
  return ({ M: "Masculino", F: "Feminino", O: "Outro" } as Record<string, string>)[gender] ?? reportValue(value);
}

function reportYesNo(value: UiRecord[string]) {
  return value === true || value === 1 || value === "1" ? "Sim" : "Não";
}

function EnrollmentPrintModal({ enrollment, onClose }: { enrollment: UiRecord; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const year = reportValue(enrollment.year);
  const className = reportValue(enrollment.requested_class);
  const shift = reportValue(enrollment.requested_shift);
  const guardian = reportValue(enrollment.guardian_name);

  return (
    <div className="dialog-backdrop enrollment-print-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="enrollment-print-modal" role="dialog" aria-modal="true" aria-labelledby="enrollment-print-title">
        <button className="enrollment-modal-close no-print" type="button" aria-label="Fechar ficha de matrícula" onClick={onClose}>×</button>
        <article className="enrollment-print-sheet">
          <header className="enrollment-print-header">
            <h1>CRECHE ESCOLA RECRESCER</h1>
            <p>Rua Gabriel Matta 99 - Recreio dos Bandeirantes</p>
            <h2 id="enrollment-print-title">Ficha de Matrícula/{year}</h2>
          </header>

          <table className="enrollment-data-table">
            <tbody>
              <tr><th>Nome do Aluno:</th><td colSpan={3}>{reportValue(enrollment.student_name)}</td></tr>
              <tr><th>Data de Nascimento:</th><td>{reportDate(enrollment.birth_date)}</td><th>Sexo:</th><td>{reportGender(enrollment.gender)}</td></tr>
              <tr><th>Nacionalidade:</th><td>{reportValue(enrollment.nationality)}</td><th>Naturalidade:</th><td>{reportValue(enrollment.birthplace)}</td></tr>
              <tr><th>Série/{year}:</th><td>{className}</td><th>Curso/Segmento:</th><td>{reportValue(enrollment.requested_education_level)}</td></tr>
              <tr><th>Turno:</th><td colSpan={3}>{shift}</td></tr>
              <tr className="enrollment-section-title"><th colSpan={4}>FILIAÇÃO:</th></tr>
              <tr><th>Nome do Pai:</th><td>{reportValue(enrollment.father_name)}</td><th>Telefone:</th><td>{reportValue(enrollment.father_phone)}</td></tr>
              <tr><th>CPF:</th><td colSpan={3}>{reportValue(enrollment.father_cpf)}</td></tr>
              <tr><th>Nome da Mãe:</th><td>{reportValue(enrollment.mother_name)}</td><th>Telefone:</th><td>{reportValue(enrollment.mother_phone)}</td></tr>
              <tr><th>CPF:</th><td colSpan={3}>{reportValue(enrollment.mother_cpf)}</td></tr>
              <tr className="enrollment-section-title"><th colSpan={4}>RESIDÊNCIA:</th></tr>
              <tr><th>Reside com:</th><td colSpan={3}>{reportValue(enrollment.lives_with)}</td></tr>
              <tr><th>Endereço do Aluno:</th><td colSpan={3}>{reportValue(enrollment.student_address)}</td></tr>
              <tr><th>Telefone residencial:</th><td colSpan={3}>{reportValue(enrollment.student_phone)}</td></tr>
              <tr><th>Observações:</th><td colSpan={3}>{reportValue(enrollment.observations)}</td></tr>
              <tr className="enrollment-section-title"><th colSpan={4}>OUTROS DADOS:</th></tr>
              <tr><th>Possui irmãos no Colégio?</th><td colSpan={3}>{reportYesNo(enrollment.siblings_in_daycare)}</td></tr>
              <tr><th>Aluno novo?</th><td colSpan={3}>{reportYesNo(enrollment.new_student)}</td></tr>
              <tr><th>Escola de Origem:</th><td colSpan={3}>{reportValue(enrollment.origin_school)}</td></tr>
            </tbody>
          </table>

          <div className="enrollment-declaration">
            <p>Sr. Diretor da Creche Escola Recrescer, Eu, <span className="fill-line">{guardian}</span>,<br />
              responsável pelo aluno(a) {reportValue(enrollment.student_name)} venho, através do presente, requerer a matrícula do citado no(a):<br />
              Turma: {className}<br />
              Turno Escolhido: {shift}<br />
              Horas Contratadas: {reportValue(enrollment.contracted_hours)}</p>
            <p className="enrollment-rule-agreement">Acatarei integralmente o Regimento Interno do Colégio.</p>
            <p className="enrollment-date-line">Rio de Janeiro, _____ de ____________________ de _______.</p>
            <div className="enrollment-signature"><span />Assinatura do Pai, Mãe ou Responsável</div>
          </div>

          <div className="enrollment-print-actions no-print">
            <button type="button" onClick={() => window.print()}>Imprimir</button>
          </div>
        </article>
      </div>
    </div>
  );
}

function ReportPage({ page }: { page: PageKey }) {
  const definition = reports[page as keyof typeof reports];
  const [rows, setRows] = useState<UiRecord[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<UiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  let hiddenColumns = ["id", "created_at", "updated_at"];
  let columnLabels: Record<string, string> = {};
  if (page === "report-enrollment") {
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "student_id", "birth_date", "nationality", "birthplace", "previous_grade_course_shift",
      "gender", "father_name", "father_phone", "father_cpf",
      "mother_name", "mother_phone", "mother_cpf",
      "lives_with", "student_address", "student_phone",
      "guardian_name", "guardian_relationship",
      "siblings_in_daycare", "siblings_details", "new_student", "origin_school",
      "requested_class_id", "requested_shift_id", "contracted_hours", "requested_shift",
      "requested_education_level", "observations"
    ];
    columnLabels = {
      year: "Ano do Requerimento",
      student_name: "Nome do Aluno",
      requested_class: "Turma"
    };
  } else if (page === "report-medical") {
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "student_id",
      "emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone",
      "secondary_contact_name", "secondary_contact_relationship", "secondary_contact_phone",
      "health_plan", "emergency_hospital",
      "measles", "chickenpox", "mumps", "rubella", "pertussis",
      "other_common_diseases", "allergies", "fever_medication",
      "tetanus_vaccine", "tetanus_vaccine_date",
      "respiratory_disease", "neurological_disease",
      "blood_type", "rh_factor", "notes", "birth_date",
    ];
    columnLabels = {
      registration: "Matrícula",
      student_name: "Nome do aluno",
      class_name: "Turma",
      shift_name: "Turno"
    };
  }

  useEffect(() => {
    if (!definition) return;
    let active = true;
    setSelectedEnrollment(null);
    setError("");
    
    listReport(definition.endpoint)
      .then((data) => { if (active) setRows(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Falha ao carregar relatório."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [definition]);

  const openEnrollmentFromGrid = (event: MouseEvent<HTMLDivElement>) => {
    if (page !== "report-enrollment") return;
    const target = event.target as HTMLElement;
    const tableRow = target.closest("tbody tr");
    if (!tableRow || !event.currentTarget.contains(tableRow)) return;
    const cells = Array.from(tableRow.querySelectorAll("td"), (cell) => cell.textContent?.trim() ?? "");
    const enrollment = rows.find((row) =>
      reportGridValue(row.year) === cells[0]
      && reportGridValue(row.student_name) === cells[1]
      && reportGridValue(row.requested_class) === cells[2]
    );
    if (enrollment) setSelectedEnrollment(enrollment);
  };

  if (!definition) return null;
  return (
    <section className="report-page">
      <div className={`page-heading ${page === "report-enrollment" ? "no-print" : ""}`}>
        <div><h2>{definition.title}</h2><p>{page === "report-enrollment" ? "Clique em uma matrícula para visualizar e imprimir a ficha." : "Dados obtidos diretamente da view de relatório."}</p></div>
        {page !== "report-enrollment" && <button className="primary-button no-print" type="button" onClick={() => window.print()}>Imprimir</button>}
      </div>
      <ErrorNotice message={error} />
      <div className={page === "report-enrollment" ? "clickable-report-grid no-print" : ""} onClick={openEnrollmentFromGrid}>
        <JsonGrid data={rows} loading={loading} searchable sortable pagination initialPageSize={25} hiddenColumns={hiddenColumns} columnLabels={columnLabels} />
      </div>
      {selectedEnrollment && <EnrollmentPrintModal enrollment={selectedEnrollment} onClose={() => setSelectedEnrollment(null)} />}
    </section>
  );
}

function UsersPage() {
  const [rows, setRows] = useState<UiRecord[]>([]);
  const [editing, setEditing] = useState<UiRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try { setRows(await listRecords("users")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar usuários."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name") ?? ""), login: String(form.get("login") ?? ""),
      password: String(form.get("password") ?? ""), active: form.get("active") === "on",
    };
    try {
      if (editing) await updateUser(Number(editing.id), values);
      else await createUser(values);
      setOpen(false); setEditing(null); setError(""); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao salvar usuário."); }
  };

  const remove = async (row: UiRecord) => {
    if (!window.confirm(`Excluir o usuário ${String(row.name)}?`)) return;
    try { await deleteUser(Number(row.id)); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao excluir usuário."); }
  };

  return (
    <section>
      <div className="page-heading">
        <div><h2>Usuários Administrativos</h2><p>Controle de acesso ao Sistema Recrescer.</p></div>
        <button className="primary-button" type="button" onClick={() => { setEditing(null); setOpen(true); }}>Novo usuário</button>
      </div>
      <ErrorNotice message={error} />
      <JsonGrid
        data={rows} loading={loading} hiddenColumns={["id", "created_at", "updated_at"]}
        columnLabels={{ name: "Nome", login: "Login", active: "Ativo" }}
        onEdit={(row) => { setEditing(row); setOpen(true); }} onDelete={remove}
        searchable sortable pagination
      />
      {open && (
        <div className="dialog-backdrop" role="presentation">
          <form className="user-dialog" onSubmit={submit}>
            <h3>{editing ? "Editar usuário" : "Novo usuário"}</h3>
            <label>Nome<input name="name" required defaultValue={String(editing?.name ?? "")} /></label>
            <label>Login<input name="login" required autoComplete="username" defaultValue={String(editing?.login ?? "")} /></label>
            <label>Senha<input name="password" type="password" autoComplete="new-password" required={!editing} placeholder={editing ? "Deixe em branco para manter" : ""} /></label>
            <label className="check-field"><input name="active" type="checkbox" defaultChecked={editing ? Boolean(editing.active) : true} /> Usuário ativo</label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="primary-button" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function Dashboard({ references }: { references: References }) {
  const cards = [
    ["Alunos", references.students.length], ["Turmas", references.classes.length],
    ["Turnos", references.shifts.length], ["Responsáveis", references.fathers.length + references.mothers.length],
  ];
  return (
    <section>
      <div className="page-heading"><div><h2>Visão Geral</h2><p>Administração escolar do Sistema Recrescer.</p></div></div>
      <div className="dashboard-grid">{cards.map(([label, value]) => <article className="dashboard-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="welcome-panel"><h3>Estrutura inicial pronta</h3><p>Use o menu para administrar cadastros, matrículas, fichas médicas e relatórios.</p></div>
    </section>
  );
}

function AuthenticatedApp({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [page, setPage] = useState<PageKey>("home");
  const [references, setReferences] = useState<References>(emptyReferences);

  useEffect(() => {
    let active = true;
    Promise.all(["shifts", "classes", "fathers", "mothers", "students"].map(listRecords)).then(([shifts, classes, fathers, mothers, students]) => {
      if (active) setReferences({ shifts, classes, fathers, mothers, students });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [page]);

  const doLogout = async () => { await logout(); onLogout(); };
  const isReport = page.startsWith("report-");

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <button type="button" className="brand" onClick={() => setPage("home")}><span>R</span><div><strong>Recrescer</strong><small>Gestão escolar</small></div></button>
        <nav>
          {menu.map((section) => <div className="nav-section" key={section.label}><p>{section.label}</p>{section.items.map(([key, label]) => <button type="button" className={page === key ? "active" : ""} key={key} onClick={() => setPage(key)}>{label}</button>)}</div>)}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar no-print"><div><strong>Sistema Recrescer</strong><span>{user.name} · {user.login}</span></div><button type="button" onClick={() => void doLogout()}>Sair</button></header>
        <div className="page-content">
          {page === "home" && <Dashboard references={references} />}
          {page === "enrollments" && <EnrollmentsPage references={references} />}
          {entities[page] && page !== "enrollments" && <EntityPage page={page} references={references} />}
          {page === "users" && <UsersPage />}
          {isReport && <ReportPage page={page} />}
        </div>
      </main>
    </div>
  );
}


export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(hasStoredToken());

  useEffect(() => {
    if (!hasStoredToken()) { setChecking(false); return; }
    currentUser().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);

  if (checking) return <main className="loading-screen">Carregando…</main>;
  if (!user) return <LoginScreen onAuthenticated={setUser} />;
  return <AuthenticatedApp user={user} onLogout={() => setUser(null)} />;
}
