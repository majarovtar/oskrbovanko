import { useEffect, useState } from "react";
import { AlertTriangle, HeartPulse, Phone, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// DEVELOPMENT ONLY: replace manual JWT with the app's real authentication when ready.
const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "oskrbovem_guardian_dev_bearer";

type Account = { id: string; name: string; email: string; role: string };
type Patient = { id: string; name: string; phone_number: string; call_time: string; consent: boolean };
type Vitals = { id: string; patient_id: string; pulse: number; spo2: number; measured_at: string };
type Call = {
  id: string; patient_id: string; started_at: string; transcript: string;
  closing_answer: string; severity: string; severity_reasons: string[];
};

type RecordData = { calls: Call[]; vitals: Vitals[] };
function displayDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" });
}
async function readApi<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Žeton ni veljaven ali je potekel (401). Prijavite se znova.");
    if (response.status === 403) throw new Error("Za te podatke nimate dovoljenja (403).");
    throw new Error(`Napaka pri pridobivanju podatkov (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function RealGuardianDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [record, setRecord] = useState<RecordData | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!isDev) return;
    const stored = sessionStorage.getItem(TOKEN_KEY) ?? "";
    setTokenInput(stored);
    setToken(stored);
  }, [isDev]);

  useEffect(() => {
    if (!isDev || !token) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      readApi<Account>("/auth/me", token, controller.signal),
      readApi<Patient[]>("/patients", token, controller.signal),
    ]).then(([person, linked]) => {
      if (controller.signal.aborted) return;
      if (person.role !== "caregiver" && person.role !== "guardian") {
        throw new Error("Uporabite žeton skrbnika (vloga caregiver), ne zdravnika.");
      }
      setAccount(person); setPatients(linked);
      setPatientId((id) => linked.some((p) => p.id === id) ? id : (linked[0]?.id ?? ""));
    }).catch((e: unknown) => {
      if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Podatkov ni bilo mogoče naložiti."); setAccount(null); setPatients([]); setPatientId(""); setRecord(null); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, refresh, isDev]);

  useEffect(() => {
    if (!token || !patientId || !account) { setRecord(null); return; }
    const controller = new AbortController();
    setRecord(null); setError(""); setLoading(true);
    Promise.all([
      readApi<Call[]>(`/patients/${encodeURIComponent(patientId)}/calls`, token, controller.signal),
      readApi<Vitals[]>(`/patients/${encodeURIComponent(patientId)}/vitals`, token, controller.signal),
    ]).then(([calls, vitals]) => {
      if (!controller.signal.aborted) setRecord({
        calls: [...calls].sort((a,b) => Date.parse(b.started_at)-Date.parse(a.started_at)),
        vitals: [...vitals].sort((a,b) => Date.parse(b.measured_at)-Date.parse(a.measured_at)),
      });
    }).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Napaka pri nalaganju."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patientId, token, account, refresh]);

  const selected = patients.find((p) => p.id === patientId);
  const latest = record?.calls[0];
  const measurement = record?.vitals[0];
  return <main className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Oskrbovanko</h1><p className="text-sm text-muted-foreground">Pregled zdravstvenih podatkov povezanih oskrbovancev</p></div>
      <Button variant="outline" onClick={() => setRefresh((n) => n + 1)} disabled={!token || loading}><RefreshCw className="mr-2 size-4" />Osveži</Button>
    </header>
    {!isDev && <div className="rounded-xl border p-4 text-sm text-muted-foreground">Podatki bodo na voljo po vključitvi prijave. Razvojni vnos žetona je izključen v produkciji.</div>}
    {isDev && <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
      <h2 className="font-semibold">Razvojni dostop za skrbnika</h2>
      <p className="text-xs text-muted-foreground">Vnesite JWT iz POST /auth/login za skrbnika. Samo za lokalni razvoj. Ne uporabljajte servisnih ali administratorskih ključev.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Skrbnikov JWT" aria-label="Skrbnikov JWT" autoComplete="off" />
        <Button onClick={() => { const cleaned = tokenInput.trim().replace(/^Bearer\s+/i, ""); sessionStorage.setItem(TOKEN_KEY, cleaned); setToken(cleaned); setRefresh((n) => n + 1); }}>Naloži podatke</Button>
      </div>
      {account && <p className="text-xs text-muted-foreground">Prijavljen skrbnik: {account.name} ({account.email})</p>}
    </section>}
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Nalagam podatke ...</p>}
    {account && <>
      {patients.length === 0 ? <p className="rounded-xl border bg-card p-4 text-sm">Skrbnik še nima povezanih pacientov.</p> : <>
        <section className="space-y-2"><h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" />Moji oskrbovanci</h2><div className="flex flex-wrap gap-2">{patients.map(p => <Button key={p.id} variant={p.id === patientId ? "default" : "outline"} onClick={() => setPatientId(p.id)}>{p.name}</Button>)}</div></section>
        {selected && <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Kako je danes z {selected.name}?</h2>{latest?.severity === "critical" ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"><AlertTriangle className="size-4"/>Kritično opozorilo</span> : <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{latest ? "Zadnji klic je na voljo" : "Še ni podatkov o klicu"}</span>}</div>
          <p className="text-sm text-muted-foreground">Predviden čas klica: {selected.call_time}</p>
          {latest ? <><p className="text-sm">Zadnji shranjeni klic: {displayDate(latest.started_at)}</p><p className="text-sm text-muted-foreground">{latest.severity === "critical" ? "V zadnjem poročilu je zabeleženo kritično opozorilo." : "Klic je shranjen. Ta različica API-ja še ne vrača povzetka počutja."}</p>{latest.severity_reasons?.length > 0 && <p className="text-sm text-destructive">{latest.severity_reasons.join(" · ")}</p>}</> : <p className="text-sm text-muted-foreground">Za tega pacienta še ni shranjenih klicev. Trenutno počutje ni potrjeno.</p>}
        </section>}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-3"><h2 className="flex items-center gap-2 font-semibold"><HeartPulse className="size-4 text-primary" />Zadnje meritve</h2>{measurement ? <><p className="text-xs text-muted-foreground">{displayDate(measurement.measured_at)}</p><div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-muted-foreground">Srčni utrip</p><p className="text-2xl font-bold">{measurement.pulse} <span className="text-sm font-normal">utr./min</span></p></div><div><p className="text-xs text-muted-foreground">SpO₂</p><p className="text-2xl font-bold">{measurement.spo2} <span className="text-sm font-normal">%</span></p></div></div></> : <p className="text-sm text-muted-foreground">Ni shranjenih meritev.</p>}</section>
          <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-3"><h2 className="flex items-center gap-2 font-semibold"><Phone className="size-4 text-primary" />Zadnji pogovori</h2>{!record?.calls.length ? <p className="text-sm text-muted-foreground">Ni shranjenih pogovorov.</p> : record.calls.slice(0, 5).map(call => <details key={call.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{displayDate(call.started_at)} · {call.severity === "critical" ? "Opozorilo" : "Opravljen klic"}</summary><p className="mt-2 text-xs text-muted-foreground">Prepis pogovora:</p><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2 font-sans text-sm">{call.transcript || "Prepis še ni na voljo."}</pre></details>)}</section>
        </div>
      </>}
    </>}
  </main>;
}
