import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, HeartPulse, Phone, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuardianCallSummary, flaggedAnswers } from "@/components/dashboard/call-report";
import { CallStatusBadge } from "@/components/dashboard/call-status-badge";
import { callStatus } from "@/lib/use-doctor-calls";
import { cn } from "@/lib/utils";
import { apiGet, formatDateTime, type ApiCall, type ApiPatient, type ApiVitals } from "@/lib/api";

type RecordData = { calls: ApiCall[]; vitals: ApiVitals[] };

/** Skrbnik: pregled povezanih oskrbovancev (podatki prijavljenega skrbnika). */
export function RealGuardianDashboard() {
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [record, setRecord] = useState<RecordData | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    apiGet<ApiPatient[]>("/patients", controller.signal)
      .then((linked) => {
        if (controller.signal.aborted) return;
        setPatients(linked);
        setPatientId((id) => linked.some((p) => p.id === id) ? id : (linked[0]?.id ?? ""));
        if (linked.length === 0) setLoading(false);
      })
      .catch((e: unknown) => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Podatkov ni bilo mogoče naložiti."); setLoading(false); } });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!patientId) { setRecord(null); return; }
    const controller = new AbortController();
    setRecord(null); setError(""); setLoading(true);
    const enc = encodeURIComponent(patientId);
    Promise.all([
      apiGet<ApiCall[]>(`/patients/${enc}/calls`, controller.signal),
      apiGet<ApiVitals[]>(`/patients/${enc}/vitals`, controller.signal),
    ]).then(([calls, vitals]) => {
      if (!controller.signal.aborted) setRecord({
        calls: [...calls].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)),
        vitals: [...vitals].sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at)),
      });
    }).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Napaka pri nalaganju."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patientId, refresh]);

  const selected = patients.find((p) => p.id === patientId);
  const latest = record?.calls[0];
  const measurement = record?.vitals[0];
  const flagged = latest ? flaggedAnswers(latest).length : 0;

  return <main className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Moji oskrbovanci</h1><p className="text-sm text-muted-foreground">Kako so vaši bližnji po vsakodnevnem klicu</p></div>
      <Button variant="outline" onClick={() => setRefresh((n) => n + 1)} disabled={loading}><RefreshCw className="mr-2 size-4" />Osveži</Button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Nalagam podatke ...</p>}
    {!loading && !error && patients.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm">Z vašim računom še ni povezan noben oskrbovanec. Povezavo uredi ambulanta.</p>}

    {patients.length > 1 && <section className="space-y-2"><h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" />Izberite oskrbovanca</h2><div className="flex flex-wrap gap-2">{patients.map((p) => <Button key={p.id} variant={p.id === patientId ? "default" : "outline"} onClick={() => setPatientId(p.id)}>{p.name}</Button>)}</div></section>}

    {selected && record && <>
      <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Kako je danes {selected.name}?</h2>
          {latest && callStatus(latest) === "critical"
            ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"><AlertTriangle className="size-4" />Nujno – zdravnik je obveščen</span>
            : flagged
              ? <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800"><AlertTriangle className="size-4" />Nekaj stvari za preverit</span>
              : latest
                ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 className="size-4" />Brez težav</span>
                : <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Še ni klica</span>}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" />Dnevni klic ob {selected.call_time || "ni določeno"} · zadnji klic: {formatDateTime(latest?.started_at)}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Phone className="size-4 text-primary" />Zadnji pogovor</h2>
          {latest ? <GuardianCallSummary call={latest} patientName={selected.name} /> : <p className="text-sm text-muted-foreground">Pogovora še ni bilo.</p>}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><HeartPulse className="size-4 text-primary" />Zadnje meritve</h2>
          {measurement ? <><p className="text-xs text-muted-foreground">{formatDateTime(measurement.measured_at)}</p><div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-muted-foreground">Srčni utrip</p><p className="text-2xl font-bold">{measurement.pulse} <span className="text-sm font-normal">/min</span></p></div><div><p className="text-xs text-muted-foreground">SpO₂</p><p className="text-2xl font-bold">{measurement.spo2} <span className="text-sm font-normal">%</span></p></div></div></> : <p className="text-sm text-muted-foreground">Ni shranjenih meritev.</p>}
        </section>
      </div>

      {record.calls.length > 1 && <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
        <h2 className="text-lg font-semibold">Prejšnji pogovori</h2>
        {record.calls.slice(1, 8).map((call) => {
          const status = callStatus(call);
          return <details key={call.id} className={cn("rounded-lg border border-l-4 p-3", status === "critical" ? "border-l-red-500 bg-red-50/50" : status === "check" ? "border-l-orange-400 bg-orange-50/50" : "border-l-emerald-400")}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-medium"><span>{formatDateTime(call.started_at)}</span><CallStatusBadge call={call} /></summary>
            <div className="mt-3"><GuardianCallSummary call={call} patientName={selected.name} /></div>
          </details>;
        })}
      </section>}
    </>}
  </main>;
}
