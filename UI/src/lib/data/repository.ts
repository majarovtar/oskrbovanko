import { createDemoDataset } from "./demo-data";
import type { ClinicalDataset, Patient, PatientRecord } from "./models";

export interface AuthorizedRecording {
  patientId: string; callId: string; url: string; expiresAt: string;
  authorization: "server_verified";
}

/** Persistent implementations must obtain identity server-side, never accept demo view state. */
export interface ClinicalRepository {
  readonly source: "fictional_demo" | "persistent";
  listPatients(): Promise<Patient[]>;
  getPatientRecord(patientId: string): Promise<PatientRecord | null>;
  /** Return a short-lived URL only after server-verified doctor/patient authorization. */
  getAuthorizedRecording(patientId: string, callId: string): Promise<AuthorizedRecording | null>;
}

/** Demo relationship scoping illustrates the contract, not production access control. */
export function createDemoRepository(demoUserId: string): ClinicalRepository {
  const data: ClinicalDataset = createDemoDataset();
  const relationships = data.relationships.filter((r) => r.userId === demoUserId && r.validUntil === null);
  const permittedIds = new Set(relationships.map((r) => r.patientId));
  return {
    source: "fictional_demo",
    async getAuthorizedRecording() { return null; },
    async listPatients() {
      return structuredClone(data.patients.filter((p) => permittedIds.has(p.id)));
    },
    async getPatientRecord(patientId) {
      if (!permittedIds.has(patientId)) return null;
      const patient = data.patients.find((p) => p.id === patientId);
      if (!patient) return null;
      const doctor = relationships.some((r) => r.patientId === patientId && r.role === "doctor");
      const calls = data.calls.filter((c) => c.patientId === patientId).sort((a, b) => (b.startedAt ?? b.scheduledAt).localeCompare(a.startedAt ?? a.scheduledAt));
      const ids = new Set(calls.map((c) => c.id));
      return structuredClone({
        patient, relationships: data.relationships.filter((r) => r.patientId === patientId),
        plans: data.plans.filter((p) => p.patientId === patientId), calls,
        attempts: data.attempts.filter((a) => ids.has(a.callId)),
        turns: data.turns.filter((t) => ids.has(t.callId)).sort((a, b) => a.callId.localeCompare(b.callId) || a.sequence - b.sequence),
        summaries: data.summaries.filter((s) => ids.has(s.callId)),
        observations: data.observations.filter((o) => o.patientId === patientId),
        measurements: data.measurements.filter((m) => m.patientId === patientId),
        alerts: data.alerts.filter((a) => a.patientId === patientId),
        notifications: data.notifications.filter((n) => n.patientId === patientId && n.recipientUserId === demoUserId),
        notes: doctor ? data.notes.filter((n) => n.patientId === patientId) : [],
        reviews: doctor ? data.reviews.filter((r) => r.patientId === patientId) : [],
      });
    },
  };
}
