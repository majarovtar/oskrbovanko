import { describe, expect, it } from "vitest";
import { createDemoDataset, DEMO_DOCTOR_ID, DEMO_GUARDIAN_ID } from "@/lib/data/demo-data";
import { createDemoRepository } from "@/lib/data/repository";
import { loadGuardianPatients, toGuardianPatient } from "@/lib/data/guardian-adapter";
import { formatClinicalTime } from "@/lib/data/format";

const data = createDemoDataset();

describe("Phase 2 shared clinical records", () => {
  it("displays offset timestamps in the monitoring plan's Slovenian timezone", () => {
    expect(formatClinicalTime("2026-11-21T09:02:00Z")).toBe("10:02");
    expect(formatClinicalTime("2026-11-21T10:02:00+01:00")).toBe("10:02");
  });
  it("preserves Marija Novak and Franc Kranjc with several days of history each", () => {
    expect(data.patients.map((p) => p.name)).toEqual(["Marija Novak", "Franc Kranjc"]);
    for (const patient of data.patients) {
      const days = new Set(data.calls.filter((c) => c.patientId === patient.id).map((c) => c.scheduledAt.slice(0, 10)));
      expect(days.size).toBe(6);
    }
  });

  it("keeps dynamic conversation lengths instead of a predetermined question count", () => {
    const lengths = data.calls.filter((c) => c.status === "completed").map((c) => data.turns.filter((t) => t.callId === c.id).length);
    expect(new Set(lengths).size).toBeGreaterThan(1);
    for (const call of data.calls) {
      const turns = data.turns.filter((t) => t.callId === call.id);
      expect(turns.map((t) => t.sequence)).toEqual(turns.map((_, i) => i));
      for (const turn of turns) {
        expect(Date.parse(turn.occurredAt)).toBeGreaterThanOrEqual(Date.parse(call.startedAt ?? call.scheduledAt));
        if (call.endedAt) expect(Date.parse(turn.occurredAt)).toBeLessThan(Date.parse(call.endedAt));
      }
    }
  });

  it("preserves source call, verbatim patient evidence and time for every observation", () => {
    expect(data.observations.length).toBeGreaterThan(0);
    for (const observation of data.observations) {
      const turn = data.turns.find((t) => t.id === observation.sourceTurnId);
      const call = data.calls.find((c) => c.id === observation.callId);
      expect(turn?.speaker).toBe("patient");
      expect(turn?.callId).toBe(observation.callId);
      expect(call?.patientId).toBe(observation.patientId);
      expect(turn?.text).toBe(observation.originalStatement);
      expect(turn?.occurredAt).toBe(observation.observedAt);
      expect(Date.parse(observation.extractedAt)).toBeGreaterThanOrEqual(Date.parse(observation.observedAt));
    }
  });

  it("preserves explicit 7/10 pain and zero while never scoring qualitative symptoms", () => {
    const pain = data.observations.find((o) => o.id === "c4-obs-eye_pain");
    expect(pain?.reportedSeverity).toEqual({ value: 7, scale: { min: 0, max: 10, label: "Bolnikova lestvica bolečine 0–10" }, source: "patient_reported" });
    expect(data.observations.find((o) => o.id === "c5-obs-eye_pain")?.reportedSeverity?.value).toBe(0);
    expect(data.observations.find((o) => o.id === "c4-obs-nausea")?.reportedSeverity).toBeNull();
    expect(data.observations.find((o) => o.id === "f20-obs-redness")?.reportedSeverity).toBeNull();
    expect(data.observations.filter((o) => o.callId === "f20" && o.symptomKey === "eye_pain")).toHaveLength(0);
    for (const observation of data.observations) {
      const score = observation.reportedSeverity;
      if (!score) continue;
      expect(observation.originalStatement).toContain(String(score.value));
      expect(observation.originalStatement).toContain("0 do 10");
      expect(score.value).toBeGreaterThanOrEqual(score.scale.min);
      expect(score.value).toBeLessThanOrEqual(score.scale.max);
    }
  });

  it("keeps measurements, summary and critical alert evidence consistent", () => {
    expect(data.measurements.find((m) => m.id === "c4-spo2")?.value).toBe(89);
    expect(data.measurements.find((m) => m.id === "c4-pulse")?.value).toBe(104);
    for (const measurement of data.measurements) {
      const turn = data.turns.find((t) => t.id === measurement.sourceTurnId);
      expect(turn?.callId).toBe(measurement.callId);
      expect(turn?.text).toContain(String(measurement.value));
      expect(turn?.occurredAt).toBe(measurement.measuredAt);
    }
    for (const summary of data.summaries) {
      expect(summary.sourceTurnIds.length).toBeGreaterThan(0);
      for (const id of summary.sourceTurnIds) {
        const turn = data.turns.find((t) => t.id === id);
        expect(turn?.callId).toBe(summary.callId);
        expect(turn?.speaker).toBe("patient");
      }
      for (const question of summary.patientQuestions) {
        expect(data.turns.some((t) => t.callId === summary.callId && t.speaker === "patient" && t.text === question)).toBe(true);
      }
    }
    const summary = data.summaries.find((s) => s.callId === "c4");
    expect(summary?.text).toContain("89 %");
    expect(summary?.text).toContain("104 utr/min");
    for (const alert of data.alerts) {
      expect(data.plans.some((p) => p.patientId === alert.patientId && p.safetyCriteria.some((c) => c.id === alert.criterionId))).toBe(true);
      if (alert.measurementId) expect(data.measurements.find((m) => m.id === alert.measurementId)?.callId).toBe(alert.callId);
      if (alert.observationId) expect(data.observations.find((o) => o.id === alert.observationId)?.callId).toBe(alert.callId);
      expect(alert.resolutionStatus).toBe("open");
    }
  });

  it("represents missed calls with attempts but no fabricated conversation or readings", () => {
    for (const id of ["c1", "f19"]) {
      expect(data.calls.find((c) => c.id === id)?.status).toBe("missed");
      expect(data.turns.filter((t) => t.callId === id)).toHaveLength(0);
      expect(data.observations.filter((o) => o.callId === id)).toHaveLength(0);
      expect(data.measurements.filter((m) => m.callId === id)).toHaveLength(0);
      expect(data.summaries.filter((s) => s.callId === id)).toHaveLength(0);
    }
    expect(data.attempts.filter((a) => a.callId === "c1")).toHaveLength(4);
    expect(data.attempts.filter((a) => a.callId === "c2").map((a) => a.outcome)).toEqual(["no_answer", "no_answer", "answered"]);
    for (const call of data.calls) {
      const answered = data.attempts.filter((a) => a.callId === call.id && a.outcome === "answered");
      expect(answered).toHaveLength(call.status === "completed" ? 1 : 0);
      if (call.status === "completed") {
        const attempt = answered[0];
        if (!attempt || !call.startedAt) throw new Error("Missing answered attempt or start time");
        expect(Date.parse(attempt.attemptedAt)).toBe(Date.parse(call.startedAt));
      }
    }
  });

  it("uses unique IDs and valid patient/call references throughout the dataset", () => {
    for (const rows of Object.values(data) as { id: string }[][]) expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const call of data.calls) expect(data.plans.find((p) => p.id === call.planId)?.patientId).toBe(call.patientId);
    for (const rows of [data.relationships, data.plans, data.observations, data.measurements, data.alerts, data.notifications, data.notes, data.reviews]) {
      for (const row of rows) expect(data.patients.some((p) => p.id === row.patientId)).toBe(true);
    }
    for (const rows of [data.attempts, data.turns, data.summaries, data.observations, data.measurements, data.alerts, data.notifications, data.notes, data.reviews]) {
      for (const row of rows) expect(data.calls.some((c) => c.id === row.callId)).toBe(true);
    }
    for (const note of data.notes) expect(data.relationships.some((r) => r.patientId === note.patientId && r.userId === note.authorUserId && r.role === "doctor")).toBe(true);
    for (const review of data.reviews) expect(data.summaries.find((s) => s.callId === review.callId)?.reviewStatus).toBe(review.status);
  });

  it("does not fabricate recordings or real notification delivery", () => {
    expect(data.calls.every((c) => c.recording === null)).toBe(true);
    expect(data.notifications.length).toBeGreaterThan(0);
    for (const n of data.notifications) {
      expect(n.provenance).toBe("fictional_demo");
      expect(data.alerts.find((a) => a.id === n.alertId)?.callId).toBe(n.callId);
      expect(data.relationships.some((r) => r.patientId === n.patientId && r.userId === n.recipientUserId)).toBe(true);
      expect(n.deliveredAt).not.toBeNull();
      expect(n.readAt).toBeNull();
    }
  });
});

describe("Centralized read contract", () => {
  it("scopes fictional patients by relationships, not a navigation role", async () => {
    expect((await createDemoRepository(DEMO_GUARDIAN_ID).listPatients()).map((p) => p.id)).toEqual(["p1", "p2"]);
    const marija = createDemoRepository("demo-marija");
    expect((await marija.listPatients()).map((p) => p.id)).toEqual(["p1"]);
    expect(await marija.getPatientRecord("p2")).toBeNull();
    expect(await createDemoRepository("unknown").listPatients()).toEqual([]);
    expect(await createDemoRepository("unknown").getPatientRecord("p1")).toBeNull();
  });

  it("keeps clinical notes doctor-only and notifications recipient-scoped", async () => {
    const guardian = await createDemoRepository(DEMO_GUARDIAN_ID).getPatientRecord("p1");
    const doctor = await createDemoRepository(DEMO_DOCTOR_ID).getPatientRecord("p1");
    expect(guardian?.notes).toEqual([]);
    expect(guardian?.reviews).toEqual([]);
    expect(doctor?.notes.map((n) => n.id)).toEqual(["note-c3"]);
    expect(guardian?.notifications.every((n) => n.recipientUserId === DEMO_GUARDIAN_ID)).toBe(true);
  });

  it("returns detached deterministic snapshots rather than shared mutable state", async () => {
    const repo = createDemoRepository(DEMO_GUARDIAN_ID);
    const first = await repo.getPatientRecord("p1");
    if (!first) throw new Error("Missing fictional patient");
    first.patient.name = "Changed";
    first.turns.splice(0);
    const second = await repo.getPatientRecord("p1");
    expect(second?.patient.name).toBe("Marija Novak");
    expect(second?.turns.length).toBeGreaterThan(0);
    expect(createDemoDataset()).toEqual(createDemoDataset());
  });

  it("projects the same source records into the existing guardian page", async () => {
    const repo = createDemoRepository(DEMO_GUARDIAN_ID);
    const patients = await loadGuardianPatients(repo);
    const marija = patients.find((p) => p.id === "p1");
    expect(marija?.calls[0]?.id).toBe("c4");
    expect(marija?.calls[0]?.pulse).toBe(104);
    expect(marija?.calls[0]?.spo2).toBe(89);
    expect(marija?.calls[0]?.recordingAvailable).toBe(false);
    const record = await repo.getPatientRecord("p1");
    if (!record) throw new Error("Missing fictional record");
    expect(toGuardianPatient(record)).toEqual(marija);
    for (const call of marija?.calls ?? []) {
      for (const answer of call.answers) {
        expect(record.turns.some((t) => t.callId === call.id && t.speaker === "patient" && t.text === answer.answer)).toBe(true);
      }
      expect(call.transcript.map((t) => t.text)).toEqual(record.turns.filter((t) => t.callId === call.id).map((t) => t.text));
    }
    expect(patients.find((p) => p.id === "p2")?.calls).toHaveLength(6);
  });
});
