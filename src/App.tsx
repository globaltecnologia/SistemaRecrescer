import { DynamicForm, type DynamicFormValues } from "@alexandretorqueti/biblioteca-global-ui";

export default function App() {
  const handleSubmit = async (values: DynamicFormValues) => {
    console.log("Dados enviados:", values);
  };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Sistema Recrescer</h1>
      <p>Aplicação integrada à Biblioteca Global UI 0.1.9</p>

      <DynamicForm
        title="Cadastro de Pessoa"
        columns={2}
        submitLabel="Salvar"
        successMessage="Cadastro realizado com sucesso."
        fields={[
          { name: "nome", label: "Nome", type: "text", required: true },
          { name: "email", label: "E-mail", type: "email", required: true },
          { name: "nascimento", label: "Data de nascimento", type: "date" },
          { name: "ativo", label: "Ativo", type: "boolean", defaultValue: true }
        ]}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
