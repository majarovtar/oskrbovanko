import type { PatientRecord, SymptomObservation } from "./models";
import { clinicalDay } from "./doctor-overview";

export type EvolutionPeriod = "7" | "14" | "30" | "all";
export type SeverityScale = NonNullable<SymptomObservation["reportedSeverity"]>["scale"];
export type EvolutionState = "improved" | "worsened" | "unchanged" | "new" | "insufficient";
export type EvolutionRow = { slot: string; day: string; values: Record<string, number | null>; points: Record<string, SymptomObservation | null> };
export type EvolutionSeries = { id: string; symptomKey: string; name: string; scale: SeverityScale; scaleId: string; observations: SymptomObservation[]; colorIndex: number };
export const scaleIdentity = (scale: SeverityScale) => JSON.stringify([scale.min, scale.max, scale.label.trim().replace(/\s+/g, " ").toLocaleLowerCase("sl-SI")]);
const addDays = (day: string, count: number) => new Date(Date.parse(`${day}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10);

export function isValidSeverity(observation: SymptomObservation) {
  const severity = observation.reportedSeverity;
  return severity !== null && severity.source === "patient_reported" && Number.isFinite(severity.value) && Number.isFinite(severity.scale.min) && Number.isFinite(severity.scale.max) && severity.scale.max > severity.scale.min && severity.value >= severity.scale.min && severity.value <= severity.scale.max && severity.scale.label.trim().length > 0;
}

export function compareObservations(previous: SymptomObservation | undefined, current: SymptomObservation | undefined) {
  if (!previous || !current || !isValidSeverity(previous) || !isValidSeverity(current)) return null;
  const before = previous.reportedSeverity;
  const after = current.reportedSeverity;
  if (!before || !after || scaleIdentity(before.scale) !== scaleIdentity(after.scale)) return null;
  const delta = after.value - before.value;
  return { delta, state: (delta < 0 ? "improved" : delta > 0 ? "worsened" : "unchanged") as EvolutionState, previous, current };
}

export function buildSymptomEvolution(record: PatientRecord, asOf: string, period: EvolutionPeriod) {
  // Every included observation must resolve to this patient's stored call and original patient turn.
  const observations = record.observations.filter((o) => {
    const turn = record.turns.find((t) => t.id === o.sourceTurnId && t.callId === o.callId);
    return o.patientId === record.patient.id && record.calls.some((c) => c.id === o.callId && c.patientId === o.patientId) && turn?.speaker === "patient" && turn.text === o.originalStatement && Number.isFinite(Date.parse(o.observedAt)) && Date.parse(o.observedAt) <= Date.parse(asOf);
  }).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.id.localeCompare(b.id));
  const end = clinicalDay(asOf);
  const earliest = [...record.calls.map((c) => clinicalDay(c.scheduledAt)), ...observations.map((o) => clinicalDay(o.observedAt))].filter((day) => day <= end).sort()[0] ?? end;
  const start = period === "all" ? earliest : addDays(end, -(Number(period) - 1));
  const filtered = observations.filter((o) => clinicalDay(o.observedAt) >= start && clinicalDay(o.observedAt) <= end);
  const allKeys = [...new Set(observations.map((o) => o.symptomKey))];
  const series: EvolutionSeries[] = [];
  for (const observation of filtered) {
    const severity = observation.reportedSeverity;
    if (!severity || !isValidSeverity(observation)) continue;
    const scaleId = scaleIdentity(severity.scale);
    let item = series.find((s) => s.symptomKey === observation.symptomKey && s.scaleId === scaleId);
    if (!item) {
      item = { id: `series${series.length}`, symptomKey: observation.symptomKey, name: observation.displayName, scale: { ...severity.scale }, scaleId, observations: [], colorIndex: Math.max(0, allKeys.indexOf(observation.symptomKey)) % 5 };
      series.push(item);
    }
    item.observations.push(observation);
  }
  const rows: EvolutionRow[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const dayObservations = series.map((s) => ({ series: s, observations: s.observations.filter((o) => clinicalDay(o.observedAt) === day) }));
    const count = Math.max(1, ...dayObservations.map((s) => s.observations.length));
    for (let slot = 0; slot < count; slot++) {
      const row: EvolutionRow = { slot: `${day}:${slot}`, day, values: {}, points: {} };
      for (const item of dayObservations) {
        const observation = item.observations[slot] ?? null;
        row.values[item.series.id] = observation?.reportedSeverity?.value ?? null;
        row.points[item.series.id] = observation;
      }
      rows.push(row);
    }
  }
  const symptoms = allKeys.flatMap((key) => {
    const all = observations.filter((o) => o.symptomKey === key);
    const inRange = filtered.filter((o) => o.symptomKey === key);
    const latest = inRange.at(-1);
    if (!latest) return [];
    const first = inRange[0];
    const change = inRange.length > 1 ? compareObservations(first, latest) : null;
    const state: EvolutionState = all.length === 1 ? "new" : change?.state ?? "insufficient";
    const changes = inRange.map((current, index) => ({ current, previous: inRange[index - 1] ?? null, change: compareObservations(inRange[index - 1], current) }));
    return [{ key, name: latest.displayName, observations: inRange, first, latest, state, change, changes, series: series.filter((s) => s.symptomKey === key), qualitative: inRange.filter((o) => !isValidSeverity(o)) }];
  });
  return { start, end, observations: filtered, series, rows, symptoms, groups: [...new Set(series.map((s) => s.scaleId))].map((id) => ({ id, scale: series.find((s) => s.scaleId === id)?.scale, series: series.filter((s) => s.scaleId === id) })), rejectedCount: record.observations.length - observations.length };
}
export type SymptomEvolution = ReturnType<typeof buildSymptomEvolution>;