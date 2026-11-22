import type { ClinicalRepository } from "./repository";
import type { PatientRecord } from "./models";
import { clinicalDay } from "./doctor-overview";

/** Convert a plan's local wall time to an instant, including Ljubljana daylight saving. */
function scheduledInstant(day: string, localTime: string, timeZone: string) {
  const wall = Date.parse(`${day}T${localTime}:00Z`);
  if (!Number.isFinite(wall)) return null;
  let instant = wall;
  for (let pass = 0; pass < 3; pass++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const rendered = Date.parse(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`);
    instant += wall - rendered;
  }
  return Number.isFinite(instant) ? new Date(instant).toISOString() : null;
}

export function projectPatientOverview(record: PatientRecord, asOf: string) {
  const today = clinicalDay(asOf);
  const completedToday = record.calls.some((call) => call.status === "completed" && Date.parse(call.endedAt ?? call.startedAt ?? call.scheduledAt) <= Date.parse(asOf) && clinicalDay(call.startedAt ?? call.scheduledAt) === today);
  const missedToday = !completedToday && record.calls.some((call) => (call.status === "missed" || call.status === "failed") && Date.parse(call.scheduledAt) <= Date.parse(asOf) && clinicalDay(call.scheduledAt) === today);
  const explicit = record.calls.filter((call) => call.status === "scheduled" && Date.parse(call.scheduledAt) > Date.parse(asOf)).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
  const plan = record.plans.find((item) => Date.parse(item.startsAt) <= Date.parse(asOf) && (!item.endsAt || Date.parse(item.endsAt) > Date.parse(asOf)));
  let nextCall = explicit?.scheduledAt ?? null;
  if (!nextCall && plan) {
    const candidate = scheduledInstant(today, plan.schedule.localTime, plan.schedule.timeZone);
    const nextDay = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    nextCall = !completedToday && candidate && Date.parse(candidate) > Date.parse(asOf) ? candidate : scheduledInstant(nextDay, plan.schedule.localTime, plan.schedule.timeZone);
    if (nextCall && plan.endsAt && Date.parse(nextCall) >= Date.parse(plan.endsAt)) nextCall = null;
  }
  const configuredPhone = record.patient.clinicPhone?.trim();
  const clinicPhone = configuredPhone && /^\+?[\d ()-]{5,}$/.test(configuredPhone) ? configuredPhone.replace(/[ ()-]/g, "") : null;
  return { patient: record.patient, asOf, completedToday, missedToday, nextCall, scheduleSource: explicit ? "scheduled_call" as const : nextCall ? "monitoring_plan" as const : null, clinicPhone };
}

export async function loadPatientOverview(repository: ClinicalRepository) {
  const patients = await repository.listPatients();
  // This identity-scoped view never selects a patient from another role's repository.
  if (patients.length !== 1 || !patients[0]) return null;
  const record = await repository.getPatientRecord(patients[0].id);
  if (!record) return null;
  const events = record.calls.filter((call) => call.status !== "scheduled").map((call) => call.endedAt ?? call.scheduledAt).sort((a, b) => Date.parse(b) - Date.parse(a));
  const asOf = repository.source === "fictional_demo" ? events[0] ?? record.plans[0]?.startsAt ?? null : new Date().toISOString();
  if (!asOf) return null;
  return { ...projectPatientOverview(record, asOf), source: repository.source };
}