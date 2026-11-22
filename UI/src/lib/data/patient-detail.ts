import type { PatientRecord, MonitoringCall, ClinicalNote } from "./models";
import type { ClinicalRepository } from "./repository";
import { projectDoctorPatient, type loadDoctorOverview } from "./doctor-overview";

export function selectPatientCall(record: PatientRecord, callId?: string) {
  const calls = [...record.calls].sort((a, b) => Date.parse(b.startedAt ?? b.scheduledAt) - Date.parse(a.startedAt ?? a.scheduledAt));
  const call = callId ? calls.find((c) => c.id === callId) ?? null : calls[0] ?? null;
  return {
    calls, call,
    summary: record.summaries.find((s) => s.callId === call?.id) ?? null,
    turns: record.turns.filter((t) => t.callId === call?.id).sort((a, b) => a.sequence - b.sequence),
    observations: record.observations.filter((o) => o.callId === call?.id).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)),
    measurements: record.measurements.filter((m) => m.callId === call?.id),
    attempts: record.attempts.filter((a) => a.callId === call?.id).sort((a, b) => Date.parse(a.attemptedAt) - Date.parse(b.attemptedAt)),
  };
}

export const callStatusLabel = (status: MonitoringCall["status"]) => ({ completed: "Zaključen", missed: "Neodgovorjen", failed: "Neuspešen", scheduled: "Načrtovan" })[status];
/** Compact doctor view; full history remains available for existing direct links. */
export function selectRecentPatientCalls(record: PatientRecord) {
  return selectPatientCall(record).calls.slice(0, 5);
}
export function callDurationLabel(call: MonitoringCall) {
  if (!call.startedAt || !call.endedAt) return null;
  const seconds = Math.max(0, Math.floor((Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000));
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
export const reviewStatusLabel = (status: "pending" | "reviewed" | "follow_up_requested") => ({ pending: "Čaka na pregled", reviewed: "Pregledano", follow_up_requested: "Potreben nadaljnji pregled" })[status];
export const detailTimestamp = (at: string) => new Date(at).toLocaleString("sl-SI", { timeZone: "Europe/Ljubljana", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export type DemoAction =
  | { type: "note"; callId: string; text: string; followUp: boolean; id: string; at: string }
  | { type: "review"; callId: string; id: string; at: string };

/** Pure demo transitions. Never write to fixtures, browser storage, or shared SSR state. */
export function applyDemoDoctorAction(record: PatientRecord, action: DemoAction, doctorId: string) {
  if (record.patient.provenance !== "fictional_demo") throw new Error("Trajno shranjevanje ni povezano. Podatki niso bili spremenjeni.");
  if (!record.relationships.some((r) => r.userId === doctorId && r.role === "doctor" && r.validUntil === null)) throw new Error("Demo zdravnik ni povezan s tem pacientom.");
  const call = record.calls.find((c) => c.id === action.callId);
  if (!call) throw new Error("Izbrani klic ne pripada pacientu.");
  if (!Number.isFinite(Date.parse(action.at)) || !action.id.trim()) throw new Error("Neveljaven zapis dejanja.");
  const next = structuredClone(record);
  if (action.type === "note") {
    const text = action.text.trim();
    if (!text) throw new Error("Vnesite besedilo opombe.");
    if (next.notes.some((n) => n.id === action.id)) throw new Error("Opomba že obstaja.");
    const note: ClinicalNote = { id: action.id, patientId: record.patient.id, callId: call.id, authorUserId: doctorId, createdAt: action.at, text, followUpStatus: action.followUp ? "requested" : "none" };
    next.notes.push(note);
  } else {
    const summary = next.summaries.find((s) => s.callId === call.id);
    if (!summary || call.status !== "completed") throw new Error("Za ta klic ni poročila za pregled.");
    const hasPendingAlert = next.alerts.some((a) => a.callId === call.id && a.reviewStatus !== "reviewed");
    if (summary.reviewStatus === "reviewed" && !hasPendingAlert) throw new Error("Poročilo je že pregledano.");
    summary.reviewStatus = "reviewed";
    next.reviews.push({ id: action.id, patientId: record.patient.id, callId: call.id, alertId: null, reviewerUserId: doctorId, reviewedAt: action.at, status: "reviewed" });
    for (const alert of next.alerts.filter((a) => a.callId === call.id && a.reviewStatus !== "reviewed")) {
      alert.reviewStatus = "reviewed";
      next.reviews.push({ id: `${action.id}-${alert.id}`, patientId: record.patient.id, callId: call.id, alertId: alert.id, reviewerUserId: doctorId, reviewedAt: action.at, status: "reviewed" });
      // Review acknowledgement is not resolution. Keep resolutionStatus and resolvedAt unchanged.
    }
  }
  return { record: next, persistence: "session_only" as const };
}

export function replaceDoctorRecord(data: Awaited<ReturnType<typeof loadDoctorOverview>>, record: PatientRecord) {
  if (data.source !== "fictional_demo" || !data.asOf) throw new Error("Demo sprememba ni na voljo za te podatke.");
  const patients = data.patients.map((p) => p.patient.id === record.patient.id ? projectDoctorPatient(record, data.asOf ?? record.calls[0]?.scheduledAt ?? "1970-01-01") : p);
  return { ...data, patients, counts: { ...data.counts, pending: patients.reduce((sum, p) => sum + p.pendingCount, 0), critical: patients.reduce((sum, p) => sum + p.openAlerts.filter((a) => a.severity === "critical").length, 0) } };
}

/** No storage-path-to-URL conversion. Persistent implementations must verify caller access server-side. */
export async function loadAuthorizedRecording(repository: ClinicalRepository, record: PatientRecord, callId: string) {
  const call = record.calls.find((c) => c.id === callId);
  if (repository.source !== "persistent" || record.patient.provenance !== "backend" || !record.patient.recordingConsent || !call?.recording || call.provenance !== "backend") return null;
  const recording = await repository.getAuthorizedRecording(record.patient.id, callId);
  if (!recording || recording.patientId !== record.patient.id || recording.callId !== callId || recording.authorization !== "server_verified" || Date.parse(recording.expiresAt) <= Date.now()) return null;
  const url = new URL(recording.url);
  if (url.protocol !== "https:" || url.username || url.password || !Number.isFinite(Date.parse(recording.expiresAt))) return null;
  return recording;
}