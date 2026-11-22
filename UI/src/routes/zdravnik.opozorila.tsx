import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { FlagBadge, flaggedAnswers } from "@/components/dashboard/call-report";
import { CallStatusBadge } from "@/components/dashboard/call-status-badge";
import { callStatus, useDoctorCalls, type PatientCall } from "@/lib/use-doctor-calls";
import { formatDateTime } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/zdravnik/opozorila")({
  head: () => pageHead("Opozorila · Zdravnik", "Klici z odgovori, ki jih je treba preveriti"),
  component: AlertsPage,
});

function AlertItem({ item }: { item: PatientCall }) {
  const critical = callStatus(item.call) === "critical";
  return (
    <article className={cn("rounded-xl border border-l-4 bg-card p-4 shadow-soft", critical ? "border-l-red-500" : "border-l-orange-400")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{item.patient.name}</h3>
            <CallStatusBadge call={item.call} />
            {!item.isLatest && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">starejši klic</span>}
          </div>
          <p className="text-sm text-muted-foreground">{formatDateTime(item.call.started_at)} · {item.patient.phone_number}</p>
        </div>
        <Link to="/zdravnik/pacient/$id" params={{ id: item.patient.id }} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted">Odpri pacienta <ArrowRight className="size-4" /></Link>
      </div>
      <ul className="mt-3 space-y-1.5">
        {flaggedAnswers(item.call).map((a) => (
          <li key={a.question.text} className="flex flex-wrap items-center gap-2 text-sm">
            <FlagBadge flag={a.flag} />
            <span className="text-muted-foreground">{a.question.text}</span>
            <span className="font-medium">»{a.value === null || a.value === "" ? "ni odgovora" : String(a.value)}«</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function AlertsPage() {
  const [refresh, setRefresh] = useState(0);
  const [onlyLatest, setOnlyLatest] = useState(true);
  const { items, loading, error } = useDoctorCalls(refresh);

  const alerts = items.filter((i) => callStatus(i.call) !== "ok" && (!onlyLatest || i.isLatest));
  const critical = alerts.filter((i) => callStatus(i.call) === "critical");
  const check = alerts.filter((i) => callStatus(i.call) === "check");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Opozorila</h1>
          <p className="mt-1 text-sm text-muted-foreground">Klici, v katerih je pacient povedal kaj, kar je dobro preveriti</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOnlyLatest((v) => !v)} className="rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted">
            {onlyLatest ? "Pokaži tudi starejše klice" : "Samo zadnji klic pacienta"}
          </button>
          <button type="button" onClick={() => setRefresh((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted"><RefreshCw className="size-4" /> Osveži</button>
        </div>
      </header>

      {loading && <p role="status" className="rounded-xl border bg-card p-4">Nalagam klice ...</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-destructive">{error}</p>}

      {!loading && !error && alerts.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-5 font-semibold text-emerald-900"><CheckCircle2 className="size-5" />Ni opozoril. Pri {onlyLatest ? "zadnjih klicih" : "nobenem klicu"} pacienti niso povedali ničesar zaskrbljujočega.</p>
      )}

      {critical.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-red-700"><AlertTriangle className="size-5" />Nujno ({critical.length})</h2>
          {critical.map((i) => <AlertItem key={i.call.id} item={i} />)}
        </section>
      )}
      {check.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-orange-700">Za preverit ({check.length})</h2>
          {check.map((i) => <AlertItem key={i.call.id} item={i} />)}
        </section>
      )}
    </div>
  );
}
