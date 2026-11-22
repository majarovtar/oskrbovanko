import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, CheckCheck, ClipboardCheck, Clock3, PhoneCall, PhoneOff, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { doctorOverviewQuery } from "@/lib/data/queries";
import { selectDoctorPatients, type DoctorPatient } from "@/lib/data/doctor-overview";
import { formatClinicalDate, formatClinicalTime } from "@/lib/data/format";
import { cn } from "@/lib/utils";

export function PatientStatus({ row }: { row: DoctorPatient }) {
  const Icon = row.critical ? ShieldAlert : row.unreachable ? PhoneOff : row.attention ? Clock3 : CheckCheck;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", row.critical ? "bg-critical-soft text-destructive" : row.attention ? "bg-accent text-accent-foreground" : "bg-success-soft text-secondary-foreground")}><Icon className="size-3.5" />{row.critical ? "Kritično" : row.unreachable ? "Nedosegljiv" : row.attention ? "Za pregled" : "Brez opozoril"}</span>;
}

export function DoctorDashboard() {
  const { data } = useSuspenseQuery(doctorOverviewQuery());
  const rows = selectDoctorPatients(data.patients, "", "all", "priority");
  const attention = rows.filter((row) => row.attention);
  const stats = [
    { title: "Aktivni pacienti", value: data.counts.active, icon: Users, tone: "text-primary bg-secondary" },
    { title: "Kritična opozorila", value: data.counts.critical, icon: ShieldAlert, tone: "text-destructive bg-critical-soft" },
    { title: "Današnji klici", value: data.counts.calls, icon: PhoneCall, tone: "text-primary bg-secondary" },
    { title: "Čakajo na pregled", value: data.counts.pending, icon: ClipboardCheck, tone: "text-accent-foreground bg-accent" },
  ];
  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-bold">Pregled pacientov</h1>{data.asOf && <p className="text-xs text-muted-foreground">{data.source === "fictional_demo" ? "Demo stanje" : "Stanje"} · {formatClinicalDate(data.asOf)} ob {formatClinicalTime(data.asOf)}</p>}</header>
    <section aria-label="Pregled spremljanja" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map((stat) => <article key={stat.title} className="rounded-xl border bg-card p-4 shadow-soft"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{stat.title}</h2><span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", stat.tone)}><stat.icon className="size-4" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{stat.value}</p></article>)}</section>
    <section aria-labelledby="attention-title" className="space-y-3"><h2 id="attention-title" className="flex items-center gap-2 text-xl font-bold"><Bell className="size-5 text-destructive" />Potrebujejo pozornost</h2>{attention.length ? attention.map((row) => <article key={row.patient.id} className={cn("flex flex-wrap items-center justify-between gap-4 rounded-xl border border-l-4 bg-card p-4 shadow-soft", row.critical ? "border-l-destructive" : "border-l-warning")}><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-bold">{row.patient.name}</h3><PatientStatus row={row} /></div><p className="text-sm leading-relaxed">{row.openAlerts.map((alert) => alert.reason).join(" ") || (row.unreachable ? "Pacient se na zadnji klic ni odzval." : "Zadnji klic čaka na zdravniški pregled.")}</p></div><Button asChild className="rounded-full"><Link to="/zdravnik/pacient/$id" params={{ id: row.patient.id }}>Odpri pacienta<ArrowRight /></Link></Button></article>) : <p className="border-y py-5 text-sm text-muted-foreground">Noben pacient trenutno ne potrebuje pozornosti.</p>}</section>
    <section aria-labelledby="patients-title" className="space-y-3"><h2 id="patients-title" className="text-xl font-bold">Pacienti</h2><div className="divide-y border-y">{rows.map((row) => <article key={row.patient.id} className="grid items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"><Link to="/zdravnik/pacient/$id" params={{ id: row.patient.id }} className="font-bold hover:text-primary">{row.patient.name}</Link><p className="text-sm text-muted-foreground">{row.latestCall ? `Zadnji klic: ${formatClinicalDate(row.latestCall.startedAt ?? row.latestCall.scheduledAt)} · ${formatClinicalTime(row.latestCall.startedAt ?? row.latestCall.scheduledAt)}` : "Brez klicev"}</p><div><PatientStatus row={row} /></div><Button asChild variant="outline" className="w-fit rounded-full"><Link to="/zdravnik/pacient/$id" params={{ id: row.patient.id }} aria-label={`Odpri: ${row.patient.name}`}>Podrobnosti<ArrowRight /></Link></Button></article>)}</div>{!rows.length && <p className="text-sm text-muted-foreground">Ni pacientov.</p>}</section>
    {data.source === "fictional_demo" && <p className="text-xs text-muted-foreground">Izmišljeni podatki · današnji klici se nanašajo na prikazani demo datum; niso namenjeni kliničnim odločitvam.</p>}
  </div>;
}
