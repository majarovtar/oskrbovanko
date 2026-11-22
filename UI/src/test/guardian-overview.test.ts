import { describe, expect, it } from "vitest";
import { DEMO_GUARDIAN_ID } from "@/lib/data/demo-data";
import { createDemoRepository } from "@/lib/data/repository";
import { loadGuardianOverview, projectGuardianPatient } from "@/lib/data/guardian-overview";

const asOf = "2026-11-21T11:00:00+01:00";
async function fixture(id = "p1") {
  const record = await createDemoRepository(DEMO_GUARDIAN_ID).getPatientRecord(id);
  if (!record) throw new Error("Missing demo patient");
  return record;
}
describe("Guardian overview", () => {
  it("distinguishes completed uneventful calls from critical alerts", async () => {
    expect(projectGuardianPatient(await fixture(), asOf).status).toBe("critical");
    const clear = projectGuardianPatient(await fixture("p2"), asOf);
    expect(clear.status).toBe("clear");
    expect(clear.latestCompleted?.id).toBe("c5");
  });
  it("does not label a missing check-in as uneventful", async () => {
    const record = await fixture("p2");
    record.calls = record.calls.filter((call) => Date.parse(call.scheduledAt) < Date.parse("2026-11-20T00:00:00+01:00"));
    const missing = projectGuardianPatient(record, "2026-11-19T11:00:00+01:00");
    expect(missing.status).toBe("attention");
    expect(missing.missedCheckIn).toBe(true);
    expect(missing.latestCompleted?.id).toBe("f18");
    expect(missing.selected.turns).toEqual([]);
    expect(missing.selected.measurements).toEqual([]);
  });
  it("shows no data when there are no calls or only an old completed check-in", async () => {
    const record = await fixture("p2");
    expect(projectGuardianPatient(record, "2026-11-22T11:00:00+01:00").status).toBe("no_data");
    record.calls = [];
    expect(projectGuardianPatient(record, asOf).status).toBe("no_data");
  });
  it("uses source-backed symptom comparisons without scoring qualitative observations", async () => {
    const marija = projectGuardianPatient(await fixture(), asOf);
    expect(marija.evolution.symptoms.find((symptom) => symptom.key === "eye_pain")?.change?.delta).toBe(4);
    expect(marija.evolution.symptoms.find((symptom) => symptom.key === "nausea")?.change).toBeNull();
    const franc = projectGuardianPatient(await fixture("p2"), asOf);
    expect(franc.evolution.symptoms.find((symptom) => symptom.key === "eye_pain")?.change?.delta).toBe(-2);
  });
  it("preserves simulated delivery statuses and does not fabricate delivery for call events", async () => {
    const patient = projectGuardianPatient(await fixture(), asOf);
    const alert = patient.events.find((event) => event.type === "alert");
    expect(alert?.deliveries).toHaveLength(3);
    expect(alert?.deliveries.every((notification) => notification.deliveryStatus === "delivered" && notification.provenance === "fictional_demo" && notification.recipientUserId === DEMO_GUARDIAN_ID)).toBe(true);
    expect(patient.events.find((event) => event.type === "completed")?.deliveries).toEqual([]);
    expect(patient.events.find((event) => event.type === "missed")?.id).toBe("c1");
  });
  it("keeps all histories and loads only linked patients through the guardian repository", async () => {
    const record = await fixture();
    const before = structuredClone(record);
    projectGuardianPatient(record, asOf);
    expect(record).toEqual(before);
    const overview = await loadGuardianOverview(createDemoRepository(DEMO_GUARDIAN_ID));
    expect(overview.patients.map((patient) => patient.record.patient.id)).toEqual(["p1", "p2"]);
    expect(overview.patients.every((patient) => patient.record.notes.length === 0)).toBe(true);
    expect(overview.asOf).toBe("2026-11-21T09:06:10.000Z");
  });
});