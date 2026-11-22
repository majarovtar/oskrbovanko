import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { pageHead } from "@/lib/page-head";

// Development-only FastAPI integration. Use the real login/session in production.
const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "oskrbovem_dev_bearer";

type Patient = { id: string; name: string; phone_number?: string; call_time?: string; consent?: boolean };
type Vitals = { id: string; patient_id: string; pulse: number; spo2: number; measured_at: string };
type Call = { id: string; patient_id: string; started_at: string; transcript?: string; closing_answer?: string; severity?: string; severity_reasons?: string[]; vitals?: { pulse: number; spo2: number; measured_at: string } | null };

async function readApi<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (res.status === 401) throw new Error("Prijava je potekla. Vnesite nov testni JWT na strani Pacienti.");
  if (res.status === 403) throw new Error("Nimate dovoljenja za ogled tega pacienta.");
  if (!res.ok) throw new Error(`Napaka API (${res.status}) pri ${path}`);
  return res.json() as Promise<T>;
}
const formatDate = (s?: string) => {
  if (!s) return "Ni podatka";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" });
};

function RealDoctorPatientDetail({ id }: { id: string }) {
  const [token, setToken] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!import.meta.env.DEV) { setLoading(false); return; }
    setToken(sessionStorage.getItem(TOKEN_KEY)?.trim() ?? "");
  }, []);

  useEffect(() => {
    if (!token || !import.meta.env.DEV) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      readApi<Patient>(`/patients/${encodeURIComponent(id)}`, token, controller.signal),
      readApi<Call[]>(`/patients/${encodeURIComponent(id)}/calls`, token, controller.signal),
      readApi<Vitals[]>(`/patients/${encodeURIComponent(id)}/vitals`, token, controller.signal),
    ]).then(([p, c, v]) => {
      if (controller.signal.aborted) return;
      setPatient(p);
      setCalls([...c].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)));
      setVitals([...v].sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at)));
    }).catch((e: unknown) => {
      if (!controller.signal.aborted) { setPatient(null); setError(e instanceof Error ? e.message : "Napaka pri nalaganju podatkov."); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, token, refresh]);

  const lastVitals = vitals[0];
  const lastCall = calls[0];
  return <main className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link to="/zdravnik" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="size-4"/> Nazaj na pregled</Link>
      <button type="button" onClick={() => setRefresh((n) => n + 1)} className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm"><RefreshCw className="size-4"/> Osveži</button>
    </div>
    {!import.meta.env.DEV && <p className="rounded-xl border bg-card p-4">Prikaz pravih podatkov je trenutno omogočen samo lokalno. Prijava bo povezana pozneje.</p>}
    {import.meta.env.DEV && !token && !loading && <div className="rounded-xl border bg-card p-4">Najprej vnesite testni JWT na strani <Link to="/zdravnik/pacienti" className="font-semibold text-primary underline">Pacienti</Link>.</div>}
    {loading && <p role="status" className="rounded-xl border bg-card p-4">Nalagam podatke pacienta ...</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-destructive">{error}</p>}
    {!loading && patient && !error && <>
      <header className="rounded-xl border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-3xl font-bold">{patient.name}</h1><p className="mt-1 text-sm text-muted-foreground">Predvideni klic: {patient.call_time || "Ni določeno"} · Zadnji klic: {formatDate(lastCall?.started_at)}</p></div>
          {lastCall?.severity === "critical" ? <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">Kritično opozorilo</span> : <span className="rounded-full bg-muted px-3 py-1 text-sm">{lastCall ? "Zadnji klic shranjen" : "Klic še ni opravljen"}</span>}
        </div>
        {lastCall?.severity_reasons?.length ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">{lastCall.severity_reasons.join(" · ")}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">Povzetek AI trenutno ni na voljo v API. Opozorila se prikazujejo samo iz shranjenih rezultatov klica.</p>
      </header>
      <section className="rounded-xl border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-lg font-bold">Zadnje meritve</h2>
        {lastVitals ? <div className="grid grid-cols-2 gap-4 sm:max-w-lg">
          <div className="rounded-lg bg-muted/50 p-4"><p className="text-sm text-muted-foreground">Srčni utrip</p><p className="text-2xl font-bold">{lastVitals.pulse} <span className="text-sm font-normal">utr./min</span></p></div>
          <div className="rounded-lg bg-muted/50 p-4"><p className="text-sm text-muted-foreground">SpO₂</p><p className="text-2xl font-bold">{lastVitals.spo2} <span className="text-sm font-normal">%</span></p></div>
        </div> : <p className="text-sm text-muted-foreground">Ni shranjenih meritev.</p>}
        {lastVitals && <p className="mt-2 text-xs text-muted-foreground">Izmerjeno: {formatDate(lastVitals.measured_at)}</p>}
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-lg font-bold">Zadnji AI klici</h2>
        {!calls.length ? <p className="text-sm text-muted-foreground">Ni shranjenih klicev. Ko backend zaključi klic, se bo pojavil tukaj.</p> :
        <div className="space-y-3">{calls.slice(0, 5).map((call) => <details key={call.id} className="rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">{formatDate(call.started_at)} · {call.severity === "critical" ? "Kritično" : "Shranjeni klic"}</summary>
          {call.severity_reasons?.length ? <p className="mt-2 text-sm text-destructive">{call.severity_reasons.join(" · ")}</p> : null}
          <h3 className="mt-3 text-sm font-semibold">Prepis pogovora</h3>
          {call.transcript ? <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 font-sans text-sm">{call.transcript}</pre> : <p className="mt-2 text-sm text-muted-foreground">Prepis ni na voljo.</p>}
          {call.closing_answer && <p className="mt-3 text-sm"><strong>Zaključni odgovor:</strong> {call.closing_answer}</p>}
        </details>)}</div>}
      </section>
      <p className="text-xs text-muted-foreground">Razvoj simptomov bo prikazan, ko bo backend shranjeval primerljive strukturirane opazovane simptome. Manjkajoči podatki niso dokaz dobrega zdravstvenega stanja.</p>
    </>}
  </main>;
}

export const Route = createFileRoute("/zdravnik/pacient/$id")({
  head: () => pageHead("Pacient · Zdravnik", "Klici in meritve pacienta iz FastAPI"),
  component: () => { const { id } = Route.useParams(); return <RealDoctorPatientDetail id={id} />; },
});
