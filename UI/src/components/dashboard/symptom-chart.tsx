import { ClientOnly } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EvolutionRow, EvolutionSeries } from "@/lib/data/symptom-evolution";
import { detailTimestamp } from "@/lib/data/patient-detail";

export const symptomColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
export const symptomSwatches = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const dayLabel = (slot: string) => new Date(`${slot.slice(0, 10)}T12:00:00Z`).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric", timeZone: "Europe/Ljubljana" });

function ObservationTooltip({ active, payload, series }: { active?: boolean; payload?: readonly { payload?: EvolutionRow }[]; series: EvolutionSeries[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="max-w-64 space-y-2 rounded-lg border bg-popover p-3 text-popover-foreground shadow-soft">{series.map((item) => {
    const observation = row.points[item.id];
    return observation ? <div key={item.id}><p className="text-sm font-bold">{item.name} · {observation.reportedSeverity?.value} / {item.scale.max}</p><p className="text-xs text-muted-foreground">{detailTimestamp(observation.observedAt)}</p><p className="mt-1 text-xs">»{observation.originalStatement}«</p></div> : null;
  })}</div>;
}

export function SymptomLineChart({ rows, series }: { rows: EvolutionRow[]; series: EvolutionSeries[] }) {
  const scales = series.filter((item, index) => series.findIndex((s) => s.scaleId === item.scaleId) === index);
  return <div className="h-56 min-w-0 w-full" aria-label="Graf poročane jakosti simptomov">
    <ClientOnly fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Priprava grafa …</div>}><ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={rows} margin={{ top: 12, right: 16, bottom: 8, left: 0 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
      <XAxis dataKey="slot" tickFormatter={dayLabel} minTickGap={28} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} dy={8} />
      {scales.map((item, index) => <YAxis key={item.scaleId} yAxisId={item.scaleId} domain={[item.scale.min, item.scale.max]} orientation={index % 2 ? "right" : "left"} width={35} padding={{ top: 8, bottom: 8 }} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />)}
      <Tooltip content={<ObservationTooltip series={series} />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
      {series.map((item) => <Line key={item.id} yAxisId={item.scaleId} name={item.name} type="linear" dataKey={`values.${item.id}`} stroke={symptomColors[item.colorIndex]} strokeWidth={2.5} connectNulls={false} isAnimationActive={false} dot={{ r: 4, fill: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6 }} />)}
    </LineChart></ResponsiveContainer></ClientOnly>
  </div>;
}
