import { describe, expect, it } from "vitest";
import { createDemoRepository } from "@/lib/data/repository";
import { loadPatientOverview, projectPatientOverview } from "@/lib/data/patient-overview";

async function fixture() {
  const record = await createDemoRepository("demo-marija").getPatientRecord("p1");
  if (!record) throw new Error("Missing patient");
  return record;
}
describe("Patient next call", () => {
  it("shows completed today and tomorrow's daily plan after today's conversation", async () => {
    const view = projectPatientOverview(await fixture(), "2026-11-21T11:00:00+01:00");
    expect(view.completedToday).toBe(true);
    expect(view.nextCall).toBe("2026-11-22T09:00:00.000Z");
    expect(view.scheduleSource).toBe("monitoring_plan");
  });
  it("uses a future explicitly scheduled call when present", async () => {
    const record = await fixture();
    const call = record.calls[0];
    if (!call) throw new Error("Missing call");
    record.calls.push({ ...call, id: "future", status: "scheduled", startedAt: null, endedAt: null, scheduledAt: "2026-11-22T12:00:00+01:00" });
    expect(projectPatientOverview(record, "2026-11-21T11:00:00+01:00").nextCall).toBe("2026-11-22T12:00:00+01:00");
  });
  it("does not claim a missed call was completed", async () => {
    const view = projectPatientOverview(await fixture(), "2026-11-18T13:00:00+01:00");
    expect(view.completedToday).toBe(false);
    expect(view.missedToday).toBe(true);
    expect(view.nextCall).toBe("2026-11-19T09:00:00.000Z");
  });
  it("handles summer timezone and a future call later today", async () => {
    expect(projectPatientOverview(await fixture(), "2027-07-01T07:00:00+02:00").nextCall).toBe("2027-07-01T08:00:00.000Z");
  });
  it("shows no next call without an active plan or future scheduled call", async () => {
    const record = await fixture();
    record.plans = [];
    expect(projectPatientOverview(record, "2026-11-21T11:00:00+01:00").nextCall).toBeNull();
  });
  it("never substitutes a patient number for an unconfigured clinic number", async () => {
    const record = await fixture();
    expect(projectPatientOverview(record, "2026-11-21T11:00:00+01:00").clinicPhone).toBeNull();
    record.patient.clinicPhone = "+386 1 555 0100";
    expect(projectPatientOverview(record, "2026-11-21T11:00:00+01:00").clinicPhone).toBe("+38615550100");
  });
  it("loads only the explicit self identity, never a guardian list", async () => {
    const self = await loadPatientOverview(createDemoRepository("demo-marija"));
    expect(self?.patient.id).toBe("p1");
    expect(self?.source).toBe("fictional_demo");
    expect(await loadPatientOverview(createDemoRepository("demo-guardian"))).toBeNull();
  });
});