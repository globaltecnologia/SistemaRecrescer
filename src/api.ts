import type { CadastroDataSource } from "@alexandretorqueti/biblioteca-global-ui";

export type UiValue = string | number | boolean | null | object | undefined;
export type UiRecord = Record<string, UiValue>;

export interface SessionUser {
  id: number;
  name: string;
  login: string;
}

export interface LoginResult {
  token: string;
  user: SessionUser;
}

let token = sessionStorage.getItem("recrescer.token") ?? "";
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function hasStoredToken() {
  return Boolean(token);
}

export function clearToken() {
  token = "";
  sessionStorage.removeItem("recrescer.token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && path !== "/auth/login") clearToken();
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível concluir a operação.";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(loginValue: string, password: string): Promise<LoginResult> {
  const result = await request<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginValue, password }),
  });
  token = result.token;
  sessionStorage.setItem("recrescer.token", token);
  return result;
}

export async function currentUser(): Promise<SessionUser> {
  const result = await request<{ user: SessionUser }>("/auth/me");
  return result.user;
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export async function listRecords(resource: string): Promise<UiRecord[]> {
  return request<UiRecord[]>(`/${resource}`);
}

export function createDataSource(resource: string): CadastroDataSource<UiRecord> {
  return {
    list: () => listRecords(resource),
    create: (values) => request<UiRecord>(`/${resource}`, { method: "POST", body: JSON.stringify(values) }),
    update: (row, values) => request<UiRecord>(`/${resource}/${String(row.id)}`, { method: "PUT", body: JSON.stringify(values) }),
    remove: (row) => request<void>(`/${resource}/${String(row.id)}`, { method: "DELETE" }),
    getRowId: (row) => String(row.id),
  };
}

export async function listReport(report: string): Promise<UiRecord[]> {
  return request<UiRecord[]>(`/reports/${report}`);
}

export async function createUser(values: { name: string; login: string; password: string; active: boolean }) {
  return request<UiRecord>("/users", { method: "POST", body: JSON.stringify(values) });
}

export async function updateUser(id: number, values: { name: string; login: string; password?: string; active: boolean }) {
  return request<UiRecord>(`/users/${id}`, { method: "PUT", body: JSON.stringify(values) });
}

export async function deleteUser(id: number) {
  return request<void>(`/users/${id}`, { method: "DELETE" });
}
