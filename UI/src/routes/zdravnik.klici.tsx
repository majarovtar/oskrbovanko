import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { CallStatusBadge } from "@/components/dashboard/call-status-badge";
import { callStatus, useDoctorCalls, type CallStatus } from "@/lib/use-doctor-calls";
import { formatDateTime } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/zdravnik/klici")({
  head: () => pageHead("Klici in poročila · Zdravnik", "Vsi klici vaših pacientov"),
  component: CallsPage,
});

type Filter = "all" | CallStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Vsi" },
  { value: "critical", label: "Nujni" },
  { value: "check", label: "Za preverit" },
  { value: "ok", label: "Brez težav" },
];

function CallsPage() {
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const { items, loading, error } = useDoctorCalls(refresh);
  const shown = items.filter((i) => filter === "all" || callStatus(i.call) === filter);
  const count = (f: Filter) => (f === "all" ? items.length : items.filter((i) => callStatus(i.call) === f).length);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Klici in poročila</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vsi klici vaših pacientov, najnovejši najprej</p>
        </div>
        <button type="button" onClick={() => setRefresh((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted"><RefreshCw className="size-4" /> Osveži</button>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter klicev">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}
            className={cn("rounded-full border px-4 py-2 text-sm", filter === f.value ? "bg-primary font-semibold text-primary-foreground" : "bg-card hover:bg-muted")}>
            {f.label} ({count(f.value)})
          </button>
        ))}
      </div>

      {loading && <p role="status" className="rounded-xl border bg-card p-4">Nalagam klice ...</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-destructive">{error}</p>}
      {!loading && !error && shown.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Ni klicev za ta filter.</p>}

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Čas klica</th><th className="p-3">Pacient</th><th className="p-3">Stanje</th><th className="p-3">Odgovorov</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y">
              {shown.map(({ patient, call }) => (
                <tr key={call.id} className="hover:bg-muted/40">
                  <td className="whitespace-nowrap p-3">{formatDateTime(call.started_at)}</td>
                  <td className="p-3 font-medium">{patient.name}</td>
                  <td className="p-3"><CallStatusBadge call={call} /></td>
                  <td className="p-3 text-muted-foreground">{call.answers.filter((a) => a.value !== null && a.value !== "").length} / {call.answers.length}</td>
                  <td className="p-3 text-right"><Link to="/zdravnik/pacient/$id" params={{ id: patient.id }} className="font-semibold text-primary hover:underline">Poročilo</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
