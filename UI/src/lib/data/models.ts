/** IDs are opaque references; timestamps are ISO 8601 with an explicit offset. */
export type Id = string;
export type Role = "doctor" | "guardian" | "patient";
export type Severity = "normal" | "warning" | "critical";
export type ReviewStatus = "pending" | "reviewed" | "follow_up_requested";
export type Provenance = "fictional_demo" | "backend";

export interface Patient {
  id: Id; name: string; phone: string; clinicalContext: string;
  clinicContact: string; clinicPhone?: string; recordingConsent: boolean; provenance: Provenance;
}
/** Separate from login/profile data. Demo IDs are not authenticated identities. */
export interface PatientRelationship {
  id: Id; patientId: Id; userId: Id; role: Role; contactName: string;
  validFrom: string; validUntil: string | null;
}
export interface MonitoringPlan {
  id: Id; patientId: Id; clinicianUserId: Id; startsAt: string; endsAt: string | null;
  goals: string[]; schedule: { localTime: string; timeZone: "Europe/Ljubljana"; frequency: "daily" };
  availableMeasurements: string[];
  safetyCriteria: { id: Id; metric: string; operator: "lt" | "gt" | "gte"; threshold: number; unit: string; severity: Severity }[];
}
export interface MonitoringCall {
  id: Id; patientId: Id; planId: Id; scheduledAt: string;
  startedAt: string | null; endedAt: string | null;
  status: "scheduled" | "completed" | "missed" | "failed";
  recording: { storagePath: string; recordedAt: string } | null;
  provenance: Provenance;
}
export interface CallAttempt {
  id: Id; callId: Id; attemptedAt: string; endedAt: string;
  outcome: "answered" | "no_answer" | "busy" | "failed";
}
export interface ConversationTurn {
  id: Id; callId: Id; sequence: number; speaker: "ai" | "patient";
  occurredAt: string; text: string;
}
export interface CallSummary {
  id: Id; callId: Id; createdAt: string; text: string;
  concerns: string[]; wellbeing: string[]; patientQuestions: string[];
  sourceTurnIds: Id[]; generatedBy: "demo_script" | "clinical_ai";
  reviewStatus: ReviewStatus;
}
/** A reported score exists only alongside explicit patient evidence and a scale. */
export interface SymptomObservation {
  id: Id; patientId: Id; callId: Id; sourceTurnId: Id;
  symptomKey: string; displayName: string; observedAt: string;
  originalStatement: string; qualitativeDescription: string;
  reportedSeverity: { value: number; scale: { min: number; max: number; label: string }; source: "patient_reported" } | null;
  extractedAt: string; extraction: "demo_script" | "backend_extraction";
}
export interface Measurement {
  id: Id; patientId: Id; callId: Id; sourceTurnId: Id | null;
  metric: string; displayName: string; value: number; unit: string;
  measuredAt: string; source: "demo_device" | "device" | "patient_reported";
}
export interface Alert {
  id: Id; patientId: Id; callId: Id; createdAt: string; severity: Severity;
  criterionId: Id | null; measurementId: Id | null; observationId: Id | null;
  reason: string; reviewStatus: ReviewStatus;
  resolutionStatus: "open" | "resolved"; resolvedAt: string | null;
}
export interface Notification {
  id: Id; patientId: Id; callId: Id; alertId: Id | null; recipientUserId: Id;
  channel: "in_app" | "email" | "sms"; createdAt: string;
  deliveryStatus: "pending" | "sent" | "delivered" | "failed";
  deliveredAt: string | null; readAt: string | null; provenance: Provenance;
}
export interface ClinicalNote {
  id: Id; patientId: Id; callId: Id; authorUserId: Id;
  createdAt: string; text: string; followUpStatus: "none" | "requested" | "completed";
}
export interface ClinicalReview {
  id: Id; patientId: Id; callId: Id; alertId: Id | null;
  reviewerUserId: Id; reviewedAt: string; status: ReviewStatus;
}
export interface ClinicalDataset {
  patients: Patient[]; relationships: PatientRelationship[]; plans: MonitoringPlan[];
  calls: MonitoringCall[]; attempts: CallAttempt[]; turns: ConversationTurn[];
  summaries: CallSummary[]; observations: SymptomObservation[]; measurements: Measurement[];
  alerts: Alert[]; notifications: Notification[]; notes: ClinicalNote[]; reviews: ClinicalReview[];
}
export interface PatientRecord {
  patient: Patient; relationships: PatientRelationship[]; plans: MonitoringPlan[];
  calls: MonitoringCall[]; attempts: CallAttempt[]; turns: ConversationTurn[];
  summaries: CallSummary[]; observations: SymptomObservation[]; measurements: Measurement[];
  alerts: Alert[]; notifications: Notification[]; notes: ClinicalNote[]; reviews: ClinicalReview[];
}