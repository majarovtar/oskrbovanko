// Povezava z FastAPI backendom: prijava (vse vloge), branje podatkov, gumb "Pokliči".
// Žeton in prijavljeni račun se hranita v sessionStorage (samo ta zavihek brskalnika).
// Samo za brskalnik: kliči iz dogodkov/efektov, ne med SSR.

export const API_URL = ((import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000").replace(/\/$/, "");
export const TOKEN_KEY = "oskrbovem_dev_bearer";
const ACCOUNT_KEY = "oskrbovem_account";

export type Role = "doctor" | "caregiver" | "patient";
export interface Account { id: string; email: string; name: string; role: Role }

/** Kam gre posamezna vloga po prijavi. */
export const HOME_BY_ROLE: Record<Role, "/zdravnik" | "/skrbnik" | "/pacient"> = {
  doctor: "/zdravnik",
  caregiver: "/skrbnik",
  patient: "/pacient",
};

export function isRole(value: string): value is Role {
  return value in HOME_BY_ROLE;
}

export function getToken(): string {
  return sessionStorage.getItem(TOKEN_KEY)?.trim() ?? "";
}

export function setToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function getStoredAccount(): Account | null {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

async function errorText(response: Response): Promise<string> {
  if (response.status === 401) return "Prijava je potekla. Prijavite se znova.";
  if (response.status === 403) return "Za te podatke nimate dovoljenja.";
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ni JSON
  }
  return `Napaka strežnika (${response.status}).`;
}

async function request<T>(method: "GET" | "POST", path: string, options: { body?: unknown; token?: string; signal?: AbortSignal } = {}): Promise<T> {
  const token = options.token ?? getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (options.signal) init.signal = options.signal;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error(`Strežnik ni dosegljiv (${API_URL}). Ali backend teče?`);
  }
  if (!response.ok) {
    const error = new Error(await errorText(response)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

/** GET z žetonom prijavljenega uporabnika. */
export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>("GET", path, signal ? { signal } : {});
}

/** Prijava: preveri geslo, shrani žeton in račun ter vrne račun. */
export async function login(email: string, password: string): Promise<Account> {
  const { access_token } = await request<{ access_token: string }>("POST", "/auth/login", { body: { email, password }, token: "" });
  const me = await request<Account>("GET", "/auth/me", { token: access_token });
  setToken(access_token);
  sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(me));
  return me;
}

export function fetchMe(): Promise<Account> {
  return request<Account>("GET", "/auth/me");
}

export function logout(): void {
  setToken(null);
  sessionStorage.removeItem(ACCOUNT_KEY);
}

/** Zdravnik sproži telefonski klic pacientu (Twilio). */
export function startPhoneCall(patientId: string): Promise<{ call_sid: string; status: string }> {
  return request("POST", `/patients/${encodeURIComponent(patientId)}/phone-call`);
}

// ------------------------------------------------------------------ podatki
export type Flag = "low" | "medium" | "high";
export interface ApiPatient { id: string; name: string; phone_number: string; call_time: string; consent: boolean }
export interface ApiAnswer { question: { text: string }; value: string | number | boolean | null; flag: Flag | null }
export interface ApiCall {
  id: string;
  patient_id: string;
  started_at: string;
  answers: ApiAnswer[];
  closing_answer: string;
  transcript: string;
  severity: "normal" | "critical" | string;
  severity_reasons: string[];
  vitals: { pulse: number; spo2: number; measured_at: string } | null;
}
export interface ApiVitals { id: string; patient_id: string; pulse: number; spo2: number; measured_at: string }

export function formatDateTime(value?: string | null): string {
  if (!value) return "Ni podatka";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" });
}
