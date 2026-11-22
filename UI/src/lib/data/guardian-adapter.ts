import type { ClinicalRepository } from "./repository";
import type { PatientRecord, Severity } from "./models";

/** Compatibility projection only: numbered answers are derived from actual conversation turns. */
export type Answer = { q: number; text: string; answer: string; flag?: "low" | "medium" | "high" };
export type GuardianCall = {
  id: string; date: string; status: "completed" | "not_reached" | "emergency";
  attempts: number; severity: Severity; reasons: string[];
  pulse: number | null; spo2: number | null; duration: string;
  summary: string; wellbeing: string[]; doctorQuestions: string[];
  answers: Answer[]; closing: string; recordingAvailable: boolean; notificationsDelivered: boolean;
  transcript: { t: string; who: "agent" | "patient"; text: string }[];
};
export type GuardianPatient = { id: string; name: string; phone: string; procedure: string; callTime: string; caregiver: string; clinic: string; doctor: string; consent: boolean; calls: GuardianCall[] };
const durationLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

export function toGuardianPatient(record: PatientRecord): GuardianPatient {
  const { patient } = record;
  return {
    id: patient.id, name: patient.name, phone: patient.phone, procedure: patient.clinicalContext,
    callTime: record.plans[0]?.schedule.localTime ?? "—",
    caregiver: record.relationships.find((r) => r.role === "guardian")?.contactName ?? "Ni podatka",
    clinic: patient.clinicContact, doctor: record.relationships.find((r) => r.role === "doctor")?.contactName ?? "Ni podatka",
    consent: patient.recordingConsent,
    calls: record.calls.map((call) => {
      const turns = record.turns.filter((t) => t.callId === call.id).sort((a, b) => a.sequence - b.sequence);
      const summary = record.summaries.find((s) => s.callId === call.id);
      const alerts = record.alerts.filter((a) => a.callId === call.id);
      const severity: Severity = alerts.some((a) => a.severity === "critical") ? "critical" : alerts.some((a) => a.severity === "warning") ? "warning" : "normal";
      const answers: Answer[] = [];
      for (const turn of turns) {
        if (turn.speaker !== "patient") continue;
        const prompt = turns.find((t) => t.sequence === turn.sequence - 1 && t.speaker === "ai");
        if (!prompt || !prompt.text.endsWith("?")) continue;
        const flagged = record.observations.some((o) => o.sourceTurnId === turn.id && alerts.some((a) => a.observationId === o.id));
        answers.push({ q: answers.length + 1, text: prompt.text, answer: turn.text, ...(flagged ? { flag: "high" as const } : {}) });
      }
      const baseTime = Date.parse(call.startedAt ?? call.scheduledAt);
      const successful = call.status === "completed";
      const notifications = record.notifications.filter((n) => n.callId === call.id);
      return {
        id: call.id, date: call.startedAt ?? call.scheduledAt,
        status: successful ? severity === "critical" ? "emergency" : "completed" : "not_reached",
        attempts: record.attempts.filter((a) => a.callId === call.id).length, severity, reasons: alerts.map((a) => a.reason),
        pulse: record.measurements.find((m) => m.callId === call.id && m.metric === "pulse")?.value ?? null,
        spo2: record.measurements.find((m) => m.callId === call.id && m.metric === "spo2")?.value ?? null,
        duration: call.startedAt && call.endedAt ? durationLabel(Math.floor((Date.parse(call.endedAt) - baseTime) / 1000)) : "—",
        summary: summary?.text ?? (call.status === "missed" ? "Bolnik se na poskuse klica ni odzval. Ni pogovora ali meritev." : "Povzetek še ni na voljo."),
        wellbeing: summary?.wellbeing ?? [], doctorQuestions: summary?.patientQuestions ?? [], answers,
        closing: turns.at(-1)?.speaker === "patient" ? turns.at(-1)?.text ?? "" : "",
        recordingAvailable: patient.recordingConsent && call.recording !== null,
        notificationsDelivered: notifications.length > 0 && notifications.every((n) => n.deliveryStatus === "delivered"),
        transcript: turns.map((t) => ({ t: durationLabel(Math.floor((Date.parse(t.occurredAt) - baseTime) / 1000)), who: t.speaker === "ai" ? "agent" as const : "patient" as const, text: t.text })),
      };
    }),
  };
}

export async function loadGuardianPatients(repository: ClinicalRepository): Promise<GuardianPatient[]> {
  const patients = await repository.listPatients();
  const records = await Promise.all(patients.map((p) => repository.getPatientRecord(p.id)));
  return records.flatMap((r) => r ? [toGuardianPatient(r)] : []);
}
