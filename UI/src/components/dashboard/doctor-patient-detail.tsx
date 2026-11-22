import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CheckCheck, ChevronDown, ChevronUp, Clock3, HeartPulse, PhoneCall, ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoctorConversation, DoctorRecording } from "./doctor-conversation";
import { MissingDoctorPatient } from "./detail-states";
import { SymptomEvolutionSection } from "./symptom-evolution";
import type { EvolutionPeriod } from "@/lib/data/symptom-evolution";
import { doctorOverviewQuery } from "@/lib/data/queries";
import { callStatusLabel, selectPatientCall, selectRecentPatientCalls } from "@/lib/data/patient-detail";
import { formatClinicalDate, formatClinicalTime } from "@/lib/data/format";
import { cn } from "@/lib/utils";

// Retain compatibility with existing evidence links; the MVP has no advanced controls.
export type DetailSearch = { call?: string; transcript?: boolean; source?: string; period?: EvolutionPeriod };
const timestamp = (at: string) => `${formatClinicalDate(at)} · ${formatClinicalTime(at)}`;
const shortSummary = (text: string) => (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]).slice(0, 3).join(" ").trim();

export function DoctorPatientDetail({ patientId, search }: { patientId: string; search: DetailSearch }) {
  const { data } = useSuspenseQuery(doctorOverviewQuery());
  const navigate = useNavigate();
  const row = data.patients.find((patient) => patient.patient.id === patientId);
  if (!row) return <MissingDoctorPatient />;
  const { record } = row;
  const selected = selectPatientCall(record, search.call);
  const latest = row.latestCall;
  const plan = record.plans.find((p) => p.id === latest?.planId);
  const guardian = record.relationships.find((relationship) => relationship.role === "guardian");
  const next = record.calls.filter((call) => call.status === "scheduled" && (!data.asOf || Date.parse(call.scheduledAt) > Date.parse(data.asOf))).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
  const warnings = [...row.openAlerts].sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"));
  const warning = warnings.length > 0 || row.unreachable;
  const recent = selectRecentPatientCalls(record);
  const selectedOutsideRecent = selected.call && search.call && !recent.some((call) => call.id === selected.call?.id) ? selected.call : null;
  const displayedCalls = selectedOutsideRecent ? [...recent, selectedOutsideRecent] : recent;
  function toggleCall(id: string) {
    void navigate({ to: "/zdravnik/pacient/$id", params: { id: patientId }, search: search.call === id ? {} : { call: id }, resetScroll: false });
  }
  return <div className="space-y-5">
    <Button asChild variant="ghost" className="-ml-3 h-8"><Link to="/zdravnik"><ArrowLeft />Nazaj na pregled</Link></Button>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
    <section aria-label="Pregled pacienta" className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">{record.patient.name}</h1><span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", row.critical ? "bg-critical-soft text-destructive" : warning ? "bg-accent text-accent-foreground" : "bg-success-soft text-secondary-foreground")}>{warning ? <ShieldAlert className="size-4" /> : <CheckCheck className="size-4" />}{row.critical ? "Kritično" : warning ? "Opozorilo" : "Brez opozoril"}</span></header>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />{latest ? `Zadnji klic: ${timestamp(latest.startedAt ?? latest.scheduledAt)}` : "Brez klicev"}</span>{data.source === "fictional_demo" && <span>Izmišljeni demo podatki</span>}</div>
      <p className="max-w-4xl text-base leading-relaxed">{row.latestSummary ? shortSummary(row.latestSummary.text) : row.unreachable ? "Zadnji klic ni bil uspešen. Nov povzetek ni na voljo." : "Povzetek zadnjega klica še ni na voljo."}</p>
      {warning && <div role="alert" className={cn("space-y-1 border-l-4 px-4 py-3 text-sm", row.critical ? "border-destructive bg-critical-soft text-destructive" : "border-warning bg-accent text-accent-foreground")}><p className="font-bold">{row.critical ? "Kritično opozorilo" : "Potreben je zdravniški pregled"}</p>{warnings.map((alert) => <p key={alert.id}>{alert.reason}</p>)}{row.unreachable && <p>Pacient se na zadnji klic ni odzval.</p>}</div>}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">{guardian && <span className="flex items-center gap-1.5"><UserRound className="size-3.5" />Skrbnik: {guardian.contactName}</span>}<span className="flex items-center gap-1.5"><CalendarClock className="size-3.5" />{next ? `Naslednji klic: ${timestamp(next.scheduledAt)}` : plan ? `Dnevni klic po načrtu: ${plan.schedule.localTime}` : "Naslednji klic še ni načrtovan"}</span></div>
    </section>
    <section aria-labelledby="measurements-heading" className="space-y-3"><h2 id="measurements-heading" className="flex items-center gap-2 text-xl font-bold"><HeartPulse className="size-5 shrink-0 text-primary" />Zadnje zdravstvene meritve</h2><div className="grid grid-cols-2 gap-3">{row.latestMeasurements.map(({ latest: measurement, flagged }) => <article key={measurement.id} className="rounded-xl border bg-card p-3 shadow-soft"><h3 className="text-sm font-semibold">{measurement.displayName}</h3><p className={cn("mt-1 text-2xl font-bold tabular-nums", flagged && "text-destructive")}>{measurement.value} <span className="text-sm font-normal text-muted-foreground">{measurement.unit}</span></p><p className="mt-1 text-xs text-muted-foreground">{timestamp(measurement.measuredAt)}</p>{flagged && <p className="mt-1 flex items-center gap-1 text-xs font-bold text-destructive"><ShieldAlert className="size-3" />Opozorilo</p>}</article>)}</div>{!row.latestMeasurements.length && <p className="text-sm text-muted-foreground">Meritve še niso na voljo.</p>}</section>
    </div>
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {data.asOf ? <SymptomEvolutionSection record={record} asOf={data.asOf} /> : <section aria-labelledby="evolution-heading" className="border-y py-5"><h2 id="evolution-heading" className="text-xl font-bold">Razvoj simptomov</h2><p className="mt-3 text-sm text-muted-foreground">Ni razpoložljivih opažanj.</p></section>}
      <section aria-labelledby="calls-heading" className="min-w-0 space-y-3 border-y py-5"><h2 id="calls-heading" className="flex items-center gap-2 text-xl font-bold"><PhoneCall className="size-5 text-primary" />Nedavni AI klici</h2>
        {search.call && !selected.call && <p role="alert" className="text-sm text-destructive">Izbrani klic ni na voljo za tega pacienta.</p>}
        <div className="divide-y">{displayedCalls.map((call) => {
          const summary = record.summaries.find((s) => s.callId === call.id);
          const expanded = search.call === call.id;
          const callWarning = record.alerts.some((a) => a.callId === call.id && a.resolutionStatus === "open");
          return <article key={call.id} className="py-3 first:pt-0"><Button variant="ghost" onClick={() => toggleCall(call.id)} aria-expanded={expanded} aria-controls={`call-${call.id}`} className="h-auto w-full justify-between whitespace-normal px-0 py-1 text-left"><span className="min-w-0 space-y-1"><span className="block text-sm font-bold">{timestamp(call.startedAt ?? call.scheduledAt)}</span><span className={cn("block text-xs font-normal", callWarning ? "text-destructive" : "text-muted-foreground")}>{callStatusLabel(call.status)}{callWarning ? " · opozorilo" : ""}{selectedOutsideRecent?.id === call.id ? " · izbrani starejši klic" : ""}</span></span>{expanded ? <ChevronUp className="shrink-0" /> : <ChevronDown className="shrink-0" />}</Button><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{summary ? shortSummary(summary.text) : call.status === "missed" ? "Pacient se ni odzval. Pogovor in meritve niso na voljo." : "Povzetek ni na voljo."}</p>
            {expanded && <div id={`call-${call.id}`} className="mt-4 space-y-4"><DoctorConversation turns={selected.turns} patientName={record.patient.name} simulated={call.provenance === "fictional_demo"} /><DoctorRecording key={call.id} record={record} call={call} />{selected.measurements.length > 0 && <div className="border-t pt-3"><h3 className="mb-2 text-sm font-bold">Meritve ob klicu</h3><dl className="space-y-1 text-sm">{selected.measurements.map((measurement) => <div key={measurement.id} className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{measurement.displayName}</dt><dd className="font-semibold">{measurement.value} {measurement.unit}</dd></div>)}</dl></div>}</div>}
          </article>;
        })}</div>{!recent.length && <p className="text-sm text-muted-foreground">Ni zabeleženih klicev.</p>}
      </section>
    </div>
  </div>;
}
