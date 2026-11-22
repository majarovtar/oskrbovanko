import type { ClinicalRepository } from "./repository";
import type { PatientRecord } from "./models";
import { clinicalDay } from "./doctor-overview";
import { selectPatientCall } from "./patient-detail";
import { buildSymptomEvolution } from "./symptom-evolution";

export function projectGuardianPatient(record: PatientRecord, asOf: string) {
  const selected = selectPatientCall(record);
  const latestCompleted = selected.calls.find((call) => call.status === "completed") ?? null;
  const completedSummary = record.summaries.find((summary) => summary.callId === latestCompleted?.id) ?? null;
  const alerts = record.alerts.filter((alert) => alert.resolutionStatus === "open");
  const missedCheckIn = selected.call?.status === "missed" || selected.call?.status === "failed";
  const noCurrentData = !latestCompleted || !selected.call || selected.call.status === "scheduled" || clinicalDay(latestCompleted.startedAt ?? latestCompleted.scheduledAt) !== clinicalDay(asOf);
  const status: "critical" | "attention" | "no_data" | "clear" = alerts.some((alert) => alert.severity === "critical") ? "critical" : alerts.length || missedCheckIn ? "attention" : noCurrentData ? "no_data" : "clear";
  const measurements = [...new Set(record.measurements.map((measurement) => measurement.metric))].flatMap((metric) => {
    const latest = record.measurements.filter((measurement) => measurement.metric === metric).sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];
    return latest ? [{ measurement: latest, flagged: alerts.some((alert) => alert.measurementId === latest.id) }] : [];
  });
  const evolution = buildSymptomEvolution(record, asOf, "7");
  // Notification rows are recipient-scoped by the repository. Call events do not imply delivery.
  const allEvents = [
    ...record.alerts.filter((alert) => alert.severity !== "normal").map((alert) => ({ id: alert.id, type: "alert" as const, at: alert.createdAt, text: alert.reason, critical: alert.severity === "critical", deliveries: record.notifications.filter((notification) => notification.alertId === alert.id) })),
    ...selected.calls.filter((call) => call.status !== "scheduled").map((call) => ({ id: call.id, type: call.status === "completed" ? "completed" as const : "missed" as const, at: call.endedAt ?? call.scheduledAt, text: call.status === "completed" ? "Nov zaključen pogovor" : "Neodgovorjen oziroma neuspešen klic", critical: false, deliveries: record.notifications.filter((notification) => notification.callId === call.id && notification.alertId === null) })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const events = allEvents.slice(0, 5);
  const recentMissed = allEvents.find((event) => event.type === "missed" && clinicalDay(event.at) >= evolution.start);
  // Keep the most recent missed check-in visible instead of burying it behind routine completions.
  if (recentMissed && !events.some((event) => event.id === recentMissed.id)) {
    const replaceIndex = events.reduce((last, event, index) => event.type === "completed" ? index : last, -1);
    if (replaceIndex >= 0) events.splice(replaceIndex, 1, recentMissed);
    else events.push(recentMissed);
    events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  return { record, selected, latestCompleted, completedSummary, alerts, missedCheckIn, noCurrentData, status, measurements, evolution, events };
}

export async function loadGuardianOverview(repository: ClinicalRepository) {
  const patients = await repository.listPatients();
  const records = (await Promise.all(patients.map((patient) => repository.getPatientRecord(patient.id)))).filter((record): record is PatientRecord => record !== null);
  const times = records.flatMap((record) => [...record.calls.filter((call) => call.status !== "scheduled").map((call) => call.endedAt ?? call.scheduledAt), ...record.alerts.map((alert) => alert.createdAt)]).sort((a, b) => Date.parse(b) - Date.parse(a));
  const asOf = repository.source === "fictional_demo" ? times[0] ?? null : new Date().toISOString();
  return { source: repository.source, asOf, patients: records.map((record) => projectGuardianPatient(record, asOf ?? new Date().toISOString())) };
}
export type GuardianOverviewPatient = ReturnType<typeof projectGuardianPatient>;