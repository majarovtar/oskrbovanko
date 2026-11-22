// Povezava z FastAPI backendom (prijava, gumb "Pokliči").
// Žeton se hrani v sessionStorage pod istim ključem, ki ga že uporabljata
// zdravnikove strani (/zdravnik in /zdravnik/pacienti), zato po prijavi delujeta brez
// ročnega vnosa JWT. Samo za brskalnik: kliči iz dogodkov/efektov, ne med SSR.

export const API_URL = ((import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000").replace(/\/$/, "");
export const TOKEN_KEY = "oskrbovem_dev_bearer";

export type Role = "doctor" | "caregiver";
export interface Account { id: string; email: string; name: string; role: Role }

export function getToken(): string {
  return sessionStorage.getItem(TOKEN_KEY)?.trim() ?? "";
}

export function setToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function errorText(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ni JSON
  }
  return `Napaka API (${response.status})`;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, token = getToken()): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(`Backend ni dosegljiv (${API_URL}). Ali teče?`);
  }
  if (!response.ok) {
    const error = new Error(await errorText(response)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

/** Prijava: preveri geslo, shrani žeton in vrne račun. */
export async function login(email: string, password: string): Promise<Account> {
  const { access_token } = await request<{ access_token: string }>("POST", "/auth/login", { email, password }, "");
  const me = await request<Account>("GET", "/auth/me", undefined, access_token);
  setToken(access_token);
  return me;
}

export function fetchMe(): Promise<Account> {
  return request<Account>("GET", "/auth/me");
}

export function logout(): void {
  setToken(null);
}

/** Zdravnik sproži telefonski klic pacientu (Twilio). */
export function startPhoneCall(patientId: string): Promise<{ call_sid: string; status: string }> {
  return request("POST", `/patients/${encodeURIComponent(patientId)}/phone-call`);
}
