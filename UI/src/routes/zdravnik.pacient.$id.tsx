import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, HeartPulse, History, Phone, RefreshCw } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { CallButton } from "@/components/dashboard/call-button";
import { CallReport, flaggedAnswers } from "@/components/dashboard/call-report";
import { apiGet, formatDateTime, type ApiCall, type ApiPatient, type ApiVitals } from "@/lib/api";
import { cn } from "@/lib/utils";
import { callStatus } from "@/lib/use-doctor-calls";

function CallStatusBadge({ call }: { call: ApiCall | undefined }) {
  if (!call) return <span className="rounded-full bg-muted px-3 py-1 text-sm">Klic še ni opravljen</span>;
  const flagged = flaggedAnswers(call).length;
  const status = callStatus(call);
  if (status === "critical") return <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">Nujno</span>;
  if (status === "check") return <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-800">Za preverit ({flagged})</span>;
  return <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">Brez težav</span>;
}

const HISTORY_BORDER = { critical: "border-l-red-500 bg-red-50/50", check: "border-l-orange-400 bg-orange-50/50", ok: "border-l-emerald-400" } as const;

function RealDoctorPatientDetail({ id }: { id: string }) {
  const [patient, setPatient] = useState<ApiPatient | null>(null);
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [vitals, setVitals] = useState<ApiVitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const enc = encodeURIComponent(id);
    Promise.all([
      apiGet<ApiPatient>(`/patients/${enc}`, controller.signal),
      apiGet<ApiCall[]>(`/patients/${enc}/calls`, controller.signal),
      apiGet<ApiVitals[]>(`/patients/${enc}/vitals`, controller.signal),
    ]).then(([p, c, v]) => {
      if (controller.signal.aborted) return;
      setPatient(p);
      setCalls([...c].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)));
      setVitals([...v].sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at)));
    }).catch((e: unknown) => {
      if (!controller.signal.aborted) { setPatient(null); setError(e instanceof Error ? e.message : "Napaka pri nalaganju podatkov."); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refresh]);

  const lastCall = calls[0];
  const olderCalls = calls.slice(1);
  const lastVitals = vitals[0];

  return <main className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link to="/zdravnik" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="size-4" /> Nazaj na pregled</Link>
      <button type="button" onClick={() => setRefresh((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted"><RefreshCw className="size-4" /> Osveži</button>
    </div>
    {loading && <p role="status" className="rounded-xl border bg-card p-4">Nalagam podatke pacienta ...</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-destructive">{error}</p>}

    {!loading && patient && !error && <>
      {/* 1. Kdo je pacient in kakšno je stanje */}
      <header className="rounded-xl border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold">{patient.name}</h1><CallStatusBadge call={lastCall} /></div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Phone className="size-4" />{patient.phone_number}</span>
              <span className="inline-flex items-center gap-1"><CalendarClock className="size-4" />Dnevni klic ob {patient.call_time || "ni določeno"}</span>
              <span className="inline-flex items-center gap-1"><History className="size-4" />Zadnji klic: {formatDateTime(lastCall?.started_at)}</span>
            </div>
          </div>
          <CallButton patientId={patient.id} />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* 2. Zadnji klic: kaj je lahko narobe, odgovori, obarvan prepis */}
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-xl font-bold">Zadnji klic</h2>
          {lastCall ? <CallReport call={lastCall} /> : <p className="text-sm text-muted-foreground">Ni shranjenih klicev. Kliknite »Pokliči«, da asistentka pokliče pacienta.</p>}
        </section>

        {/* 3. Meritve in povzetek */}
        <aside className="space-y-5">
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><HeartPulse className="size-5 text-primary" />Zadnje meritve</h2>
            {lastVitals ? <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Srčni utrip</p><p className="text-2xl font-bold">{lastVitals.pulse} <span className="text-sm font-normal">/min</span></p></div>
                <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">SpO₂</p><p className="text-2xl font-bold">{lastVitals.spo2} <span className="text-sm font-normal">%</span></p></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Izmerjeno: {formatDateTime(lastVitals.measured_at)}</p>
            </> : <p className="text-sm text-muted-foreground">Ni shranjenih meritev.</p>}
          </section>
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h2 className="mb-3 text-lg font-bold">Povzetek</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Vseh klicev</dt><dd className="text-xl font-bold">{calls.length}</dd></div>
              <div><dt className="text-muted-foreground">Nujnih klicev</dt><dd className={cn("text-xl font-bold", calls.some((c) => c.severity === "critical") && "text-red-700")}>{calls.filter((c) => c.severity === "critical").length}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      {/* 4. Zgodovina */}
      <section className="rounded-xl border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-xl font-bold">Prejšnji klici</h2>
        {olderCalls.length === 0 ? <p className="text-sm text-muted-foreground">Ni prejšnjih klicev.</p> : (
          <div className="space-y-2">
            {olderCalls.map((call) => (
              <details key={call.id} className={cn("rounded-lg border border-l-4 p-3", HISTORY_BORDER[callStatus(call)])}>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-medium">
                  <span>{formatDateTime(call.started_at)}</span>
                  <CallStatusBadge call={call} />
                </summary>
                <div className="mt-4"><CallReport call={call} /></div>
              </details>
            ))}
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">Oznake odgovorov so samodejne in temeljijo na besedah v odgovoru; ne nadomeščajo zdravniške presoje. Nejasni odgovori niso označeni, zato preberite prepis.</p>
    </>}
  </main>;
}

export const Route = createFileRoute("/zdravnik/pacient/$id")({
  head: () => pageHead("Pacient · Zdravnik", "Klici, odgovori in meritve pacienta"),
  component: PatientDetailRoute,
});

function PatientDetailRoute() {
  const { id } = Route.useParams();
  return <RealDoctorPatientDetail id={id} />;
}
