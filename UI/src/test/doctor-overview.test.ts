import { describe, expect, it } from "vitest";
import { createDemoRepository } from "@/lib/data/repository";
import { DEMO_DOCTOR_ID } from "@/lib/data/demo-data";
import { clinicalDay, loadDoctorOverview, projectDoctorPatient, selectDoctorPatients } from "@/lib/data/doctor-overview";

const load = () => loadDoctorOverview(createDemoRepository(DEMO_DOCTOR_ID));
describe("Doctor overview from shared clinical records", () => {
  it("counts active patients, open critical alerts, today's calls and distinct pending calls", async () => {
    const data = await load();
    expect(data.counts).toEqual({ active: 2, critical: 2, calls: 2, completedCalls: 2, pending: 1 });
    expect(data.asOf && clinicalDay(data.asOf)).toBe("2026-11-21");
  });
  it("prioritizes the critical patient and filters open alerts independently of review status", async () => {
    const { patients } = await load();
    expect(selectDoctorPatients(patients, "", "critical", "priority").map((p) => p.patient.name)).toEqual(["Marija Novak"]);
    expect(selectDoctorPatients(patients, "", "attention", "priority").map((p) => p.patient.name)).toEqual(["Marija Novak"]);
    expect(selectDoctorPatients(patients, "", "clear", "priority").map((p) => p.patient.name)).toEqual(["Franc Kranjc"]);
  });
  it("does not call a patient unreachable after a later successful call", async () => {
    const { patients, asOf } = await load();
    expect(selectDoctorPatients(patients, "", "unreachable", "priority")).toHaveLength(0);
    const marija = patients.find((p) => p.patient.id === "p1");
    if (!marija || !asOf) throw new Error("Missing fixture");
    const record = structuredClone(marija.record);
    record.calls = record.calls.filter((c) => c.scheduledAt.startsWith("2026-11-16") || c.status === "missed");
    expect(projectDoctorPatient(record, asOf).unreachable).toBe(true);
  });
  it("preserves latest measurement evidence and correct changes", async () => {
    const { patients } = await load();
    const marija = patients.find((p) => p.patient.id === "p1");
    expect(marija?.latestMeasurements.find((m) => m.latest.metric === "spo2")).toMatchObject({ latest: { id: "c4-spo2", value: 89 }, previous: { value: 96 }, delta: -7, flagged: true });
    expect(marija?.latestMeasurements.find((m) => m.latest.metric === "pulse")).toMatchObject({ latest: { value: 104 }, delta: 30 });
    expect(marija?.observations.find((o) => o.symptomKey === "nausea")?.reportedSeverity).toBeNull();
  });
  it("searches shared patient context and sorts in both directions without mutating records", async () => {
    const { patients } = await load();
    expect(selectDoctorPatients(patients, "  FRANC ", "all", "name").map((p) => p.patient.id)).toEqual(["p2"]);
    expect(selectDoctorPatients(patients, "levo oko", "all", "name").map((p) => p.patient.id)).toEqual(["p2"]);
    expect(selectDoctorPatients(patients, "", "all", "name").map((p) => p.patient.id)).toEqual(["p2", "p1"]);
    expect(selectDoctorPatients(patients, "", "all", "name", true).map((p) => p.patient.id)).toEqual(["p1", "p2"]);
    expect(selectDoctorPatients(patients, "", "all", "call").map((p) => p.patient.id)).toEqual(["p1", "p2"]);
    expect(patients.map((p) => p.patient.id)).toEqual(["p1", "p2"]);
  });
  it("uses Ljubljana calendar days at the UTC date boundary", () => {
    expect(clinicalDay("2026-11-21T23:25:00Z")).toBe("2026-11-22");
  });
});