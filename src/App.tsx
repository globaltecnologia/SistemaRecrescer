import { useEffect, useMemo, useState, type FormEvent } from "react";
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

function EntityPage({ page, references }: { page: PageKey; references: References }) {
  const definition = entities[page];
  const resource = definition?.resource ?? "";
  const dataSource = useMemo(() => createDataSource(resource), [resource]);
  if (!definition) return null;
  
  // Configurações específicas por entidade
  let hiddenColumns = ["id", "created_at", "updated_at"];
  let columnLabels: Record<string, string> = {};

  if (page === "students") {
    // Grid de Alunos: apenas Matrícula, Série e Nome do Aluno
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

  if (page === "enrollments") {
    // Ficha de Matrícula: apenas Ano, Nome do aluno e Turma (com nome da turma do backend)
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "student_id", "birth_date", "nationality", "birthplace", "previous_grade_course_shift",
      "gender", "father_name", "father_phone", "father_cpf",
      "mother_name", "mother_phone", "mother_cpf",
      "lives_with", "student_address", "student_phone",
      "guardian_name", "guardian_relationship",
      "siblings_in_daycare", "siblings_details", "new_student", "origin_school",
      "requested_class_id", "requested_shift_id", "contracted_hours"
    ];
    columnLabels = {
      year: "Ano",
      student_name: "Aluno",
      class_name: "Turma"
    };
  }

  if (page === "mothers") {
    // Grid de Mães: apenas Nome da Mãe, Telefone Residencial e Telefone Comercial
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
    // Grid de Ficha Mu00e9dica: apenas nome do aluno
    hiddenColumns = [
      "id", "created_at", "updated_at",
      "emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone",
      "secondary_contact_name", "secondary_contact_relationship", "secondary_contact_phone",
      "health_plan", "emergency_hospital",
      "measles", "chickenpox", "mumps", "rubella", "pertussis",
      "other_common_diseases", "allergies", "fever_medication",
      "tetanus_vaccine", "tetanus_vaccine_date",
      "respiratory_disease", "neurological_disease",
      "blood_type", "rh_factor", "notes"
    ];
    columnLabels = { student_id: "Nome do aluno" };
  }

  if (page === "fathers") {
    // Grid de Pais: apenas Nome do Pai, Telefone Residencial e Telefone Comercial
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

  if (page === "medical_records") {
    // Grid de Ficha Mu00e9dica: apenas nome do aluno
    hiddenColumns = [
      "id", "created_at", "updated_at",
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

function ReportPage({ page }: { page: PageKey }) {
  const definition = reports[page as keyof typeof reports];
  const [rows, setRows] = useState<UiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!definition) return;
    let active = true;
    setLoading(true);
    listReport(definition.endpoint)
      .then((data) => { if (active) setRows(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Falha ao carregar relatório."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [definition]);

  if (!definition) return null;
  return (
    <section className="report-page">
      <div className="page-heading">
        <div><h2>{definition.title}</h2><p>Dados obtidos diretamente da view de relatório.</p></div>
        <button className="primary-button no-print" type="button" onClick={() => window.print()}>Imprimir</button>
      </div>
      <ErrorNotice message={error} />
      <JsonGrid data={rows} loading={loading} searchable sortable pagination initialPageSize={25} />
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
          {entities[page] && <EntityPage page={page} references={references} />}
          {page === "users" && <UsersPage />}
          {isReport && <ReportPage page={page} />}
        </div>
      </main>
    </div>
  );
}

interface AppProps {}

export default function App({}: AppProps) {
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
