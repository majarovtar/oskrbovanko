import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarCheck2, HeartPulse, PhoneCall, RefreshCw, Users } from "lucide-react";

// Development-only bridge to the existing FastAPI API. The real login will replace
// sessionStorage with an authenticated session; never put a service/admin key here.
const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "oskrbovem_dev_bearer";

type Patient = { id: string; name: string; phone_number: string; call_time: string; consent: boolean };
type Call = { id: string; patient_id: string; started_at: string; transcript?: string; closing_answer?: string; severity?: string; severity_reasons?: string[] };
type Vitals = { id: string; patient_id: string; pulse: number; spo2: number; measured_at: string };
type PatientData = { patient: Patient; calls: Call[]; vitals: Vitals[]; error?: string };

async function getJson<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Žeton je neveljaven ali je potekel (401). Pridobite nov testni JWT.");
    if (response.status === 403) throw new Error("Dostop ni dovoljen (403).");
    throw new Error(`API napaka (${response.status}) pri ${path}.`);
  }
  return response.json() as Promise<T>;
}

function formattedTime(value?: string | null): string {
  if (!value) return "Ni podatka";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" });
}

function latest<T>(list: T[], field: (item: T) => string): T | undefined {
  return [...list].sort((a, b) => Date.parse(field(b)) - Date.parse(field(a)))[0];
}

function Metric({ title, value, icon: Icon }: { title: string; value: string | number; icon: typeof Users }) {
  return <div className="rounded-xl border bg-card p-4 shadow-soft">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2><Icon className="size-5 text-primary" /></div>
    <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
  </div>;
}

export function RealDoctorDashboard() {
  const [rows, setRows] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)?.trim();
    setHasToken(Boolean(token));
    if (!token) { setRows([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getJson<Patient[]>("/patients", token, controller.signal)
      .then(async (patients) => {
        const fetched = await Promise.all(patients.map(async (patient): Promise<PatientData> => {
          const id = encodeURIComponent(patient.id);
          const [calls, vitals] = await Promise.allSettled([
            getJson<Call[]>(`/patients/${id}/calls`, token, controller.signal),
            getJson<Vitals[]>(`/patients/${id}/vitals`, token, controller.signal),
          ]);
          return {
            patient,
            calls: calls.status === "fulfilled" ? calls.value : [],
            vitals: vitals.status === "fulfilled" ? vitals.value : [],
            error: calls.status === "rejected" || vitals.status === "rejected" ? "Nekaterih podatkov ni bilo mogoče naložiti." : undefined,
          };
        }));
        if (!controller.signal.aborted) setRows(fetched);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) { setRows([]); setError(err instanceof Error ? err.message : "Napaka pri nalaganju pacientov."); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const getLastCall = (row: PatientData) => latest(row.calls, (c) => c.started_at);
  const critical = rows.filter((r) => getLastCall(r)?.severity === "critical");
  const callCount = rows.reduce((count, r) => count + r.calls.filter((c) => {
    if (!c.started_at) return false;
    const d = new Date(c.started_at);
    return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
  }).length, 0);

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Pregled pacientov</h1><p className="mt-1 text-sm text-muted-foreground">Podatki iz zalednega sistema · lokalni razvoj</p></div>
      <button type="button" onClick={() => setRefresh((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted"><RefreshCw className="size-4" /> Osveži</button>
    </header>
    {!hasToken && !loading && <section className="rounded-xl border bg-card p-5"><p className="font-semibold">Najprej povežite testni račun.</p><p className="mt-1 text-sm text-muted-foreground">Na strani Pacienti vnesite testni JWT in kliknite »Naloži paciente«. Nato se vrnite na Pregled.</p><Link to="/zdravnik/pacienti" className="mt-3 inline-flex items-center gap-2 font-semibold text-primary">Odpri paciente <ArrowRight className="size-4" /></Link></section>}
    {loading && <p role="status" className="rounded-xl border bg-card p-5">Nalagam paciente, klice in meritve ...</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive bg-card p-5 text-destructive">{error}</p>}
    {!loading && hasToken && !error && <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Pregled spremljanja">
        <Metric title="Pacienti" value={rows.length} icon={Users} />
        <Metric title="Kritični zadnji klici" value={critical.length} icon={AlertTriangle} />
        <Metric title="Današnji shranjeni klici" value={callCount} icon={PhoneCall} />
        <Metric title="Pacienti z meritvami" value={rows.filter((r) => r.vitals.length > 0).length} icon={HeartPulse} />
      </section>
      {critical.length > 0 && <section className="space-y-2"><h2 className="flex items-center gap-2 text-xl font-bold"><AlertTriangle className="size-5 text-destructive" /> Kritična opozorila iz klicev</h2>{critical.map((r) => <div key={r.patient.id} className="rounded-xl border border-l-4 border-l-destructive bg-card p-4"><p className="font-bold">{r.patient.name}</p><p className="mt-1 text-sm">{getLastCall(r)?.severity_reasons?.join(" · ") || "Zadnji klic ima oznako kritično."}</p></div>)}</section>}
      <section className="space-y-3"><h2 className="text-xl font-bold">Pacienti</h2>
        {rows.length === 0 ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Za ta testni račun ni povezanih pacientov.</p> :
          <div className="space-y-3">{rows.map((r) => {
            const call = getLastCall(r);
            const vitals = latest(r.vitals, (v) => v.measured_at);
            return <article key={r.patient.id} className="rounded-xl border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-lg font-bold">{r.patient.name}</h3><p className="text-sm text-muted-foreground">Dnevni klic: {r.patient.call_time || "Ni določeno"}</p></div>
                {call?.severity === "critical" ? <span className="rounded-full bg-critical-soft px-3 py-1 text-xs font-bold text-destructive">Kritično</span> : <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{call ? "Zadnji klic shranjen" : "Še ni klicev"}</span>}
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Zadnji klic</p><p>{formattedTime(call?.started_at)}</p></div>
                <div><p className="text-xs text-muted-foreground">Srčni utrip</p><p>{vitals ? `${vitals.pulse} utr./min` : "Ni podatka"}</p></div>
                <div><p className="text-xs text-muted-foreground">SpO₂</p><p>{vitals ? `${vitals.spo2} %` : "Ni podatka"}</p></div>
              </div>
              {r.error && <p className="mt-2 text-xs text-destructive">{r.error}</p>}
              <div className="mt-3 flex justify-end"><Link to="/zdravnik/pacient/$id" params={{ id: r.patient.id }} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted">Odpri pacienta <ArrowRight className="size-4" /></Link></div>
            </article>;
          })}</div>}
      </section>
      <p className="text-xs text-muted-foreground"><CalendarCheck2 className="mr-1 inline size-3" />Opozorila izhajajo samo iz shranjene oznake zadnjega klica. Manjkajoči podatki niso dokaz, da ni zdravstvenih težav. To je razvojni pregled.</p>
    </>}
  </div>;
}
