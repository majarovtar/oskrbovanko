import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, HelpCircle, Phone, RefreshCw, MessageCircle, HeartPulse, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// DEVELOPMENT ONLY: the real login implementation will supply the access token later.
const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const PATIENT_DEV_TOKEN_KEY = "oskrbovem_patient_dev_bearer";

type Account = { id: string; name: string; role: string };
type Patient = { id: string; name: string; call_time: string; consent: boolean };
type Call = { id: string; patient_id: string; started_at: string; transcript: string; severity: string };
type PatientInfo = { account: Account; patient: Patient; calls: Call[] };

async function fetchApi<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const result = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (result.status === 401) throw new Error("Prijava je potekla ali žeton ni veljaven (401).");
  if (result.status === 403) throw new Error("Za ogled tega pacienta nimate dovoljenja (403).");
  if (!result.ok) throw new Error(`Napaka pri povezavi s strežnikom (${result.status}).`);
  return (await result.json()) as T;
}

export function RealPatientDashboard({ historyOnly = false }: { historyOnly?: boolean }) {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [info, setInfo] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!isDev) return;
    const saved = sessionStorage.getItem(PATIENT_DEV_TOKEN_KEY) ?? "";
    setTokenInput(saved);
    setToken(saved);
  }, [isDev]);

  useEffect(() => {
    if (!isDev || !token) { setInfo(null); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setInfo(null);
    (async () => {
      const [account, patients] = await Promise.all([
        fetchApi<Account>("/auth/me", token, controller.signal),
        fetchApi<Patient[]>("/patients", token, controller.signal),
      ]);
      if (account.role !== "patient" && account.role !== "caregiver") {
        throw new Error("Za ta pogled uporabite testni pacientov račun ali povezan skrbnikov račun.");
      }
      // Do not guess which person is signed in if more than one patient is linked.
      if (patients.length !== 1) {
        throw new Error(patients.length === 0
          ? "Ta račun še nima povezanega pacienta."
          : "Ta račun ima več povezanih pacientov. Za test pacientovega pogleda uporabite račun z enim povezanim pacientom.");
      }
      const patient = patients[0];
      const calls = await fetchApi<Call[]>(`/patients/${encodeURIComponent(patient.id)}/calls`, token, controller.signal);
      if (!controller.signal.aborted) setInfo({ account, patient, calls: [...calls].sort((a,b) => Date.parse(b.started_at) - Date.parse(a.started_at)) });
    })().catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Podatkov ni bilo mogoče pridobiti.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, refresh, isDev]);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todaysCall = info?.calls.some(c => !Number.isNaN(Date.parse(c.started_at)) && new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(c.started_at)) === today);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>{historyOnly ? <><Button asChild variant="ghost" className="mb-3 min-h-12 text-lg"><Link to="/pacient"><ArrowLeft />Nazaj</Link></Button><h1 className="text-3xl font-bold">Moji klici</h1></> : <><h1 className="text-3xl font-bold sm:text-4xl">{info ? `Dober dan, ${info.patient.name}!` : "Dober dan!"}</h1><p className="mt-2 text-xl leading-relaxed">Poklicali vas bomo po telefonu in vas vprašali, kako se počutite.</p></>}</div>
      <Button variant="outline" onClick={() => setRefresh(v => v + 1)} disabled={!token || loading}><RefreshCw className="mr-2 size-4"/>Osveži</Button>
    </header>
    {isDev && <section className="space-y-2 rounded-2xl border bg-card p-4">
      <h2 className="text-base font-semibold">Razvojni dostop za pacienta</h2>
      <p className="text-sm text-muted-foreground">Za test uporabite JWT pacientovega računa ali skrbnika z enim povezanim pacientom. To ni končna prijava.</p>
      <div className="flex flex-col gap-2 sm:flex-row"><Input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Testni JWT" aria-label="Testni JWT" autoComplete="off"/><Button onClick={() => { const clean = tokenInput.trim().replace(/^Bearer\s+/i, ""); sessionStorage.setItem(PATIENT_DEV_TOKEN_KEY, clean); setToken(clean); setRefresh(v => v + 1); }}>Naloži podatke</Button></div>
    </section>}
    {!isDev && <p className="rounded-xl border p-4 text-base">Pacientovi podatki bodo na voljo po vključitvi prijave.</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-base text-destructive">{error}</p>}
    {loading && <p role="status">Nalagam podatke …</p>}
    {info && (historyOnly ? <section className="space-y-3 rounded-2xl border bg-card p-5">
      {info.calls.length ? info.calls.slice(0,10).map(c => <div key={c.id} className="rounded-xl border p-4"><p className="text-lg font-semibold">{new Date(c.started_at).toLocaleString("sl-SI", {dateStyle:"medium",timeStyle:"short"})}</p><p className="text-base text-muted-foreground">Shranjeni pogovor</p></div>) : <p className="text-xl">Za zdaj še ni shranjenih pogovorov.</p>}
    </section> : <>
      <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="next-call-title">
        <h2 id="next-call-title" className="flex items-center gap-3 text-2xl font-bold"><CalendarClock className="size-8 text-primary"/>Dnevni telefonski klic</h2>
        <p className="text-xl">Predvidena ura klica</p>
        <p className="text-4xl font-bold tabular-nums">{info.patient.call_time || "Ni podatka"}</p>
        <p className="text-lg text-muted-foreground">To je običajna ura klica. Naslednji termin še ni posebej potrjen.</p>
        {todaysCall ? <p className="flex items-center gap-2 text-xl font-semibold"><CheckCircle2 className="size-6 text-primary"/>Danes je bil shranjen pogovor.</p> : <p className="text-xl">Za danes še ni shranjenega pogovora.</p>}
        <p className="text-xl leading-relaxed">Poklicali vas bomo na običajen telefon. Aplikacije ni treba odpirati.</p>
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-bold">Kako poteka klic?</h2><div className="grid gap-3 sm:grid-cols-3">{[{icon:Phone,text:"Oglasite se na telefon."},{icon:MessageCircle,text:"Povejte, kako se počutite."},{icon:HeartPulse,text:"Po potrebi opravite meritev."}].map((s,i) => <div key={s.text} className="rounded-xl border bg-card p-4"><s.icon className="mb-3 size-8 text-primary"/><p className="text-xl font-semibold">{i+1}. {s.text}</p></div>)}</div></section>
      <section className="grid gap-3 sm:grid-cols-2"><Button asChild variant="outline" className="min-h-16 rounded-xl text-lg"><Link to="/pacient/klici"><Phone className="size-5"/>Moji klici</Link></Button><Button asChild variant="outline" className="min-h-16 rounded-xl text-lg"><Link to="/pacient/pomoc"><HelpCircle className="size-5"/>Pomoč</Link></Button></section>
      <p className="text-base text-muted-foreground">Telefonska številka ambulante v trenutnem API-ju še ni na voljo. Za nujno pomoč uporabite številko 112.</p>
    </>)}
  </div>;
}
