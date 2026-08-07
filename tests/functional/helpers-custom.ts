import { expect, type APIRequestContext } from "@playwright/test";

// Usar as credenciais do usuário alexandre
export const testUser = { login: "alexandre", password: "1234" };

export function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Login usando o backend remoto (porta 3002)
export async function apiLogin(request: APIRequestContext) {
  const response = await request.post("http://localhost:3002/api/auth/login", { data: testUser });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token as string;
}

export async function apiCreate(request: APIRequestContext, resource: string, data: Record<string, unknown>) {
  const token = await apiLogin(request);
  const response = await request.post(`http://localhost:3002/api/${resource}`, {
    headers: { Authorization: `Bearer ${token}` }, data,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<Record<string, unknown>>;
}

export async function apiGet(request: APIRequestContext, resource: string) {
  const token = await apiLogin(request);
  const response = await request.get(`http://localhost:3002/api/${resource}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<Record<string, unknown>[]>;
}
