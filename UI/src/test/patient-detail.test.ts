import { describe, expect, it } from "vitest";
import { createDemoRepository, type ClinicalRepository } from "@/lib/data/repository";
import { DEMO_DOCTOR_ID, DEMO_GUARDIAN_ID } from "@/lib/data/demo-data";
import { applyDemoDoctorAction, callDurationLabel, loadAuthorizedRecording, replaceDoctorRecord, selectPatientCall } from "@/lib/data/patient-detail";
import { loadDoctorOverview } from "@/lib/data/doctor-overview";

async function fixture() {
  const record = await createDemoRepository(DEMO_DOCTOR_ID).getPatientRecord("p1");
  if (!record) throw new Error("Missing fixture");
  return record;
}
describe("Phase 4 patient details", () => {
  it("derives call duration in minutes and seconds, with no duration for missed calls", async () => {
    const record = await fixture();
    const call = selectPatientCall(record, "c4").call;
    const missed = selectPatientCall(record, "c1").call;
    if (!call || !missed) throw new Error("Missing fixture calls");
    expect(callDurationLabel(call)).toBe("4 min 5 s");
    expect(callDurationLabel(missed)).toBeNull();
  });
  it("renders arbitrary ordered turns, original source statements, and unscored observations", async () => {
    const record = await fixture();
    const detail = selectPatientCall(record, "c4");
    expect(detail.turns).toHaveLength(14);
    expect(selectPatientCall(record, "m16").turns).toHaveLength(8);
    for (const observation of detail.observations) {
      expect(detail.turns.find((t) => t.id === observation.sourceTurnId)).toMatchObject({ speaker: "patient", text: observation.originalStatement, occurredAt: observation.observedAt });
    }
    expect(detail.observations.find((o) => o.symptomKey === "nausea")?.reportedSeverity).toBeNull();
    record.turns.push({ id: "extra", callId: "c4", speaker: "patient", sequence: 90, occurredAt: "2026-11-21T10:07:00+01:00", text: "Dodatna izjava brez novega vprašanja." });
    expect(selectPatientCall(record, "c4").turns.at(-1)?.id).toBe("extra");
  });
  it("does not fabricate a transcript or measurements for missed calls or select another patient's call", async () => {
    const record = await fixture();
    const missed = selectPatientCall(record, "c1");
    expect(missed.turns).toEqual([]);
    expect(missed.summary).toBeNull();
    expect(missed.measurements).toEqual([]);
    expect(missed.attempts).toHaveLength(4);
    expect(selectPatientCall(record, "c5").call).toBeNull();
  });
  it("adds a real session-only note without mutating fixtures", async () => {
    const record = await fixture();
    const result = applyDemoDoctorAction(record, { type: "note", callId: "c4", text: "  Pokličem ambulanto.  ", followUp: true, id: "new-note", at: "2026-11-22T00:40:00+01:00" }, DEMO_DOCTOR_ID);
    expect(result.persistence).toBe("session_only");
    expect(result.record.notes.at(-1)).toMatchObject({ text: "Pokličem ambulanto.", callId: "c4", authorUserId: DEMO_DOCTOR_ID, followUpStatus: "requested" });
    expect(record.notes).toHaveLength(1);
    expect((await fixture()).notes).toHaveLength(1);
  });
  it("reviews the report and its alerts without resolving them, and updates overview pending count", async () => {
    const data = await loadDoctorOverview(createDemoRepository(DEMO_DOCTOR_ID));
    const record = await fixture();
    const result = applyDemoDoctorAction(record, { type: "review", callId: "c4", id: "review-new", at: "2026-11-22T00:41:00+01:00" }, DEMO_DOCTOR_ID);
    expect(result.record.summaries.find((s) => s.callId === "c4")?.reviewStatus).toBe("reviewed");
    expect(result.record.alerts.every((a) => a.reviewStatus === "reviewed" && a.resolutionStatus === "open" && a.resolvedAt === null)).toBe(true);
    expect(result.record.reviews.filter((r) => r.callId === "c4")).toHaveLength(3);
    expect(replaceDoctorRecord(data, result.record).counts).toMatchObject({ pending: 0, critical: 2 });
    expect(record.summaries.find((s) => s.callId === "c4")?.reviewStatus).toBe("pending");
  });
  it("rejects invalid, non-doctor, empty, missed-report, and backend mutations without success", async () => {
    const record = await fixture();
    const action = { type: "note" as const, callId: "c4", text: "Opomba", followUp: false, id: "n", at: "2026-11-22T00:40:00+01:00" };
    expect(() => applyDemoDoctorAction(record, { ...action, text: " " }, DEMO_DOCTOR_ID)).toThrow();
    expect(() => applyDemoDoctorAction(record, action, DEMO_GUARDIAN_ID)).toThrow();
    expect(() => applyDemoDoctorAction(record, { ...action, callId: "c5" }, DEMO_DOCTOR_ID)).toThrow();
    expect(() => applyDemoDoctorAction(record, { type: "review", callId: "c1", id: "r", at: action.at }, DEMO_DOCTOR_ID)).toThrow();
    record.patient.provenance = "backend";
    expect(() => applyDemoDoctorAction(record, action, DEMO_DOCTOR_ID)).toThrow();
  });
  it("never plays fictional, non-consented, unauthorized, or expired recordings", async () => {
    const record = await fixture();
    const demo = createDemoRepository(DEMO_DOCTOR_ID);
    expect(await loadAuthorizedRecording(demo, record, "c4")).toBeNull();
    const call = record.calls.find((c) => c.id === "c4");
    if (!call) throw new Error("Missing call");
    record.patient.provenance = "backend";
    call.provenance = "backend";
    call.recording = { storagePath: "private/c4.wav", recordedAt: call.startedAt ?? call.scheduledAt };
    const grant = { patientId: "p1", callId: "c4", url: "https://recordings.example.test/private.wav", expiresAt: "2099-01-01T00:00:00Z", authorization: "server_verified" as const };
    const persistent: ClinicalRepository = { ...demo, source: "persistent", getAuthorizedRecording: async () => grant };
    expect((await loadAuthorizedRecording(persistent, record, "c4"))?.url).toBe(grant.url);
    record.patient.recordingConsent = false;
    expect(await loadAuthorizedRecording(persistent, record, "c4")).toBeNull();
    record.patient.recordingConsent = true;
    expect(await loadAuthorizedRecording({ ...persistent, getAuthorizedRecording: async () => ({ ...grant, expiresAt: "2020-01-01T00:00:00Z" }) }, record, "c4")).toBeNull();
    expect(await loadAuthorizedRecording({ ...persistent, getAuthorizedRecording: async () => ({ ...grant, patientId: "p2" }) }, record, "c4")).toBeNull();
    expect(await loadAuthorizedRecording({ ...persistent, getAuthorizedRecording: async () => null }, record, "c4")).toBeNull();
  });
});