import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CheckCircle2, ChevronRight, Clock, Equal, HeartHandshake, HeartPulse, PhoneMissed, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guardianOverviewQuery } from "@/lib/data/queries";
import { formatClinicalDate as date, formatClinicalTime as time } from "@/lib/data/format";
import { callStatusLabel } from "@/lib/data/patient-detail";
import type { GuardianOverviewPatient } from "@/lib/data/guardian-overview";
import { GuardianConversation } from "./guardian-conversation";
import { cn } from "@/lib/utils";

const initials = (name: string) => name.split(" ").map((word) => word[0]).join("");
const stamp = (at: string) => `${date(at)} · ${time(at)}`;
const short = (text: string) => (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]).slice(0, 3).join(" ").trim();
const statuses = {
  critical: { label: "Kritično opozorilo", tone: "bg-critical-soft text-destructive", icon: AlertTriangle },
  attention: { label: "Potrebna pozornost", tone: "bg-accent text-accent-foreground", icon: AlertTriangle },
  clear: { label: "Brez novih opozoril", tone: "bg-success-soft text-secondary-foreground", icon: CheckCircle2 },
  no_data: { label: "Še ni podatkov", tone: "bg-muted text-muted-foreground", icon: Clock },
};
const deliveryLabels = { pending: "Čaka na dostavo", sent: "Poslano", delivered: "Dostavljeno", failed: "Dostava ni uspela" };
const channels = { in_app: "V aplikaciji", email: "E-pošta", sms: "SMS" };

export function GuardianDashboard() {
  const { data } = useSuspenseQuery(guardianOverviewQuery());
  const [pid, setPid] = useState(data.patients[0]?.record.patient.id ?? "");
  const selected = data.patients.find((patient) => patient.record.patient.id === pid) ?? data.patients[0];
  return <div className="space-y-6">
    <section aria-labelledby="guardian-heading" className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-2"><h1 id="guardian-heading" className="text-2xl font-bold">Oskrbovanko</h1>{data.source === "fictional_demo" && data.asOf && <p className="text-xs text-muted-foreground">Demo stanje · {stamp(data.asOf)}</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.patients.map((patient) => {
        const person = patient.record.patient;
        const critical = patient.status === "critical";
        const active = person.id === selected?.record.patient.id;
        return <Button variant="ghost" key={person.id} onClick={() => setPid(person.id)} aria-pressed={active} className={cn("flex h-auto min-w-0 items-center gap-3 whitespace-normal rounded-2xl border p-4 text-left shadow-soft", active ? "border-primary bg-secondary" : "bg-card hover:bg-muted/60", critical && !active && "border-destructive/40")}><span className={cn("grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold", critical ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>{initials(person.name)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-sm font-bold">{person.name}</span>{critical && <AlertTriangle className="size-3.5 shrink-0 text-destructive" />}</span><span className="block text-xs text-muted-foreground">{person.clinicalContext}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Button>;
      })}</div>
      {selected ? <CurrentStatus patient={selected} /> : <p className="text-sm text-muted-foreground">Ni povezanih oskrbovancev.</p>}
    </section>
    {selected && <GuardianContent key={selected.record.patient.id} patient={selected} />}
  </div>;
}

function CurrentStatus({ patient }: { patient: GuardianOverviewPatient }) {
  const status = statuses[patient.status];
  return <article className={cn("space-y-3 rounded-2xl border bg-card p-5 shadow-soft", patient.status === "critical" && "border-destructive/30")}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Kako je danes z {patient.record.patient.name}?</h2><span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", status.tone)}><status.icon className="size-4" />{status.label}</span></div>
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" />{patient.latestCompleted ? `Zadnji zaključen klic: ${stamp(patient.latestCompleted.startedAt ?? patient.latestCompleted.scheduledAt)}` : "Zaključenega klica še ni."}</p>
    {patient.missedCheckIn ? <p className="font-semibold text-accent-foreground">Zadnji klic ni bil uspešen. Svežega poročila o počutju ni; to ne pomeni, da je vse v redu.</p> : patient.noCurrentData ? <p className="text-sm text-muted-foreground">Za prikazani dan še ni zaključenega pogovora. Trenutno počutje ni potrjeno.</p> : null}
    {patient.completedSummary && <p className="text-sm leading-relaxed">{patient.missedCheckIn || patient.noCurrentData ? "Zadnje razpoložljivo poročilo: " : ""}{short(patient.completedSummary.text)}</p>}
    {patient.alerts.length > 0 && <div role="alert" className={cn("space-y-1 border-l-4 px-3 py-2 text-sm", patient.status === "critical" ? "border-destructive bg-critical-soft text-destructive" : "border-warning bg-accent text-accent-foreground")}>{patient.alerts.map((alert) => <p key={alert.id}>{alert.reason}</p>)}</div>}
  </article>;
}

function GuardianContent({ patient }: { patient: GuardianOverviewPatient }) {
  const { record, selected, evolution } = patient;
  const call = selected.call;
  const doctor = record.relationships.find((relationship) => relationship.role === "doctor");
  return <>
    <section aria-labelledby="latest-call-heading" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="latest-call-heading" className="flex items-center gap-2 text-xl font-bold"><HeartHandshake className="size-5 text-primary" />Zadnji klic</h2><GuardianConversation patient={patient} /></div>
      {call ? <div className="space-y-4"><div className="flex flex-wrap items-center gap-3 text-sm"><strong>{stamp(call.startedAt ?? call.scheduledAt)}</strong><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{callStatusLabel(call.status)}</span></div><p className="text-sm leading-relaxed">{selected.summary ? short(selected.summary.text) : call.status === "missed" || call.status === "failed" ? "Pogovor ni bil opravljen. Za ta klic ni povzetka, simptomov ali meritev." : "Povzetek še ni na voljo."}</p>
        {selected.observations.length > 0 && <div className="flex flex-wrap gap-x-6 gap-y-2">{selected.observations.map((observation) => <p key={observation.id} className="text-sm"><span className="font-semibold">{observation.displayName}:</span> {observation.qualitativeDescription}</p>)}</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{patient.measurements.map(({ measurement, flagged }) => <article key={measurement.id} className="rounded-2xl border bg-card p-4 shadow-soft"><h3 className="flex items-center gap-2 text-sm font-semibold"><HeartPulse className="size-4 text-primary" />{measurement.displayName}</h3><p className={cn("mt-2 text-2xl font-bold tabular-nums", flagged && "text-destructive")}>{measurement.value} <span className="text-sm font-normal text-muted-foreground">{measurement.unit}</span></p><p className="mt-1 text-xs text-muted-foreground">{stamp(measurement.measuredAt)}</p>{flagged && <p className="mt-1 text-xs font-bold text-destructive">Opozorilo</p>}</article>)}</div>{!patient.measurements.length && <p className="text-sm text-muted-foreground">Meritve še niso na voljo.</p>}{patient.missedCheckIn && patient.measurements.length > 0 && <p className="text-xs text-muted-foreground">Prikazane meritve so iz prejšnjih klicev, ne iz zadnjega neuspešnega klica.</p>}
      </div> : <p className="text-sm text-muted-foreground">Klicev še ni.</p>}
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section aria-labelledby="changes-heading" className="space-y-3 border-t pt-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="changes-heading" className="flex items-center gap-2 text-xl font-bold"><Activity className="size-5 text-primary" />Spremembe počutja</h2><span className="text-xs text-muted-foreground">Zadnjih 7 dni</span></div><div className="divide-y">{evolution.symptoms.map((symptom) => {
        const state = symptom.state;
        const Icon = state === "worsened" ? ArrowUpRight : state === "improved" ? ArrowDownRight : state === "unchanged" ? Equal : Activity;
        const label = state === "worsened" ? "Poslabšanje" : state === "improved" ? "Izboljšanje" : state === "unchanged" ? "Brez spremembe" : state === "new" ? "Na novo navedeno" : "Ni primerljivih ocen";
        return <article key={symptom.key} className="space-y-2 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{symptom.name}</h3><span className={cn("flex items-center gap-1 text-xs font-bold", state === "worsened" ? "text-destructive" : state === "improved" ? "text-secondary-foreground" : "text-muted-foreground")}><Icon className="size-4" />{label}</span></div><p className="text-sm text-muted-foreground">{symptom.latest.qualitativeDescription}</p>{symptom.change && <p className="text-xs text-muted-foreground">Pacientova ocena: {symptom.change.previous.reportedSeverity?.value} → {symptom.change.current.reportedSeverity?.value} · {symptom.change.current.reportedSeverity?.scale.min}–{symptom.change.current.reportedSeverity?.scale.max}</p>}<p className="text-xs text-muted-foreground">Zadnja navedba: {stamp(symptom.latest.observedAt)}</p></article>;
      })}</div>{!evolution.symptoms.length && <p className="text-sm text-muted-foreground">Opažanj še ni.</p>}<p className="text-xs text-muted-foreground">Manjkajoča omemba ne pomeni izboljšanja ali izginotja simptoma.</p></section>
      <section aria-labelledby="notifications-heading" className="space-y-3 border-t pt-5"><h2 id="notifications-heading" className="flex items-center gap-2 text-xl font-bold"><Bell className="size-5 text-primary" />Obvestila in kontakt</h2><div className="divide-y">{patient.events.map((event) => <article key={event.id} className="space-y-2 py-3"><div className="flex items-start gap-2">{event.critical ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /> : event.type === "missed" ? <PhoneMissed className="mt-0.5 size-4 shrink-0 text-accent-foreground" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />}<div><p className={cn("text-sm font-semibold", event.critical && "text-destructive")}>{event.text}</p><p className="mt-1 text-xs text-muted-foreground">{stamp(event.at)}</p></div></div>{event.deliveries.length ? <ul className="space-y-1 pl-6 text-xs text-muted-foreground">{event.deliveries.map((delivery) => <li key={delivery.id}>{channels[delivery.channel]} · {delivery.provenance === "fictional_demo" ? "Simulirano: " : ""}{deliveryLabels[delivery.deliveryStatus]}{delivery.deliveredAt ? ` · ${stamp(delivery.deliveredAt)}` : ""}</li>)}</ul> : <p className="pl-6 text-xs text-muted-foreground">Dogodek klica · dostava obvestila ni zabeležena.</p>}</article>)}</div>{!patient.events.length && <p className="text-sm text-muted-foreground">Ni novih dogodkov.</p>}<div className="space-y-2 border-t pt-4"><h3 className="flex items-center gap-2 text-sm font-bold"><Stethoscope className="size-4 text-primary" />Zdravstveni kontakt</h3><p className="text-sm">{record.patient.clinicContact}</p>{doctor && <p className="text-sm text-muted-foreground">{doctor.contactName}</p>}<p className="text-xs text-muted-foreground">Telefonska številka ambulante ni zabeležena.</p></div></section>
    </div>
    {record.patient.provenance === "fictional_demo" && <p className="border-t pt-4 text-xs text-muted-foreground">Izmišljeni demo podatki in simulirana dostava obvestil · niso namenjeni kliničnim odločitvam.</p>}
  </>;
}
