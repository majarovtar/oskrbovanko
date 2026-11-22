import type { ClinicalRepository } from "./repository";
import type { Measurement, PatientRecord } from "./models";

export type PatientFilter = "all" | "critical" | "attention" | "clear" | "unreachable";
export type PatientSort = "priority" | "name" | "call";
export const clinicalDay = (at: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));

export function projectDoctorPatient(record: PatientRecord, asOf: string) {
  const calls = [...record.calls].sort((a, b) => Date.parse(b.startedAt ?? b.scheduledAt) - Date.parse(a.startedAt ?? a.scheduledAt));
  const latestCall = calls[0] ?? null;
  const openAlerts = record.alerts.filter((a) => a.resolutionStatus === "open");
  const critical = openAlerts.some((a) => a.severity === "critical");
  const unreachable = latestCall?.status === "missed" || latestCall?.status === "failed";
  const pendingCallIds = new Set([
    ...record.summaries.filter((s) => s.reviewStatus === "pending").map((s) => s.callId),
    ...openAlerts.filter((a) => a.reviewStatus === "pending").map((a) => a.callId),
  ]);
  const followUp = record.notes.some((n) => n.followUpStatus === "requested") || openAlerts.some((a) => a.reviewStatus === "follow_up_requested");
  const attention = critical || openAlerts.length > 0 || unreachable || pendingCallIds.size > 0 || followUp;
  const active = record.plans.some((p) => Date.parse(p.startsAt) <= Date.parse(asOf) && (p.endsAt === null || Date.parse(p.endsAt) > Date.parse(asOf)));
  const latestMeasurements = [...new Set(record.measurements.map((m) => m.metric))].map((metric) => {
    const readings = record.measurements.filter((m) => m.metric === metric).sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt));
    const latest = readings[0];
    if (!latest) return null;
    return { latest, previous: readings[1] ?? null, delta: readings[1] ? latest.value - readings[1].value : null, flagged: openAlerts.some((a) => a.measurementId === latest.id) };
  }).filter((m): m is { latest: Measurement; previous: Measurement | null; delta: number | null; flagged: boolean } => m !== null);
  const latestSummary = record.summaries.find((s) => s.callId === latestCall?.id) ?? null;
  const observations = record.observations.filter((o) => o.callId === latestCall?.id);
  return { record, patient: record.patient, latestCall, latestSummary, observations, openAlerts, critical, unreachable, attention, active, pendingCount: pendingCallIds.size, latestMeasurements, priority: critical ? 4 : unreachable ? 3 : attention ? 2 : 0 };
}
export type DoctorPatient = ReturnType<typeof projectDoctorPatient>;

export async function loadDoctorOverview(repository: ClinicalRepository) {
  const patients = await repository.listPatients();
  const records = (await Promise.all(patients.map((p) => repository.getPatientRecord(p.id)))).filter((r): r is PatientRecord => r !== null);
  // The fictional snapshot's latest event anchors "today"; never relabel historical data as live.
  const events = records.flatMap((r) => [...r.calls.map((c) => c.endedAt ?? c.scheduledAt), ...r.alerts.map((a) => a.createdAt), ...r.measurements.map((m) => m.measuredAt)]).sort((a, b) => Date.parse(b) - Date.parse(a));
  const asOf = events[0] ?? null;
  const rows = asOf ? records.map((r) => projectDoctorPatient(r, asOf)) : [];
  const todayCalls = asOf ? records.flatMap((r) => r.calls).filter((c) => clinicalDay(c.scheduledAt) === clinicalDay(asOf)) : [];
  return { source: repository.source, asOf, patients: rows, counts: { active: rows.filter((r) => r.active).length, critical: rows.reduce((n, r) => n + r.openAlerts.filter((a) => a.severity === "critical").length, 0), calls: todayCalls.length, completedCalls: todayCalls.filter((c) => c.status === "completed").length, pending: rows.reduce((n, r) => n + r.pendingCount, 0) } };
}

export function selectDoctorPatients(rows: DoctorPatient[], search: string, filter: PatientFilter, sort: PatientSort, descending = false) {
  const term = search.trim().toLocaleLowerCase("sl-SI");
  const selected = rows.filter((r) => `${r.patient.name} ${r.patient.clinicalContext}`.toLocaleLowerCase("sl-SI").includes(term) &&
    (filter === "all" || (filter === "critical" && r.critical) || (filter === "attention" && r.attention) || (filter === "clear" && r.openAlerts.length === 0) || (filter === "unreachable" && r.unreachable)));
  return selected.sort((a, b) => {
    const nameOrder = a.patient.name.localeCompare(b.patient.name, "sl-SI");
    const order = sort === "name" ? nameOrder : sort === "priority" ? b.priority - a.priority || nameOrder : Date.parse(b.latestCall?.startedAt ?? b.latestCall?.scheduledAt ?? "1970-01-01") - Date.parse(a.latestCall?.startedAt ?? a.latestCall?.scheduledAt ?? "1970-01-01") || nameOrder;
    return descending ? -order : order;
  });
}