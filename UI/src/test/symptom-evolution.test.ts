import { describe, expect, it } from "vitest";
import { createDemoRepository } from "@/lib/data/repository";
import { DEMO_DOCTOR_ID } from "@/lib/data/demo-data";
import { buildSymptomEvolution, compareObservations } from "@/lib/data/symptom-evolution";

async function fixture(id = "p1") {
  const record = await createDemoRepository(DEMO_DOCTOR_ID).getPatientRecord(id);
  if (!record) throw new Error("Missing fixture");
  return record;
}
const asOf = "2026-11-21T11:00:00+01:00";
describe("Symptom evolution evidence rules", () => {
  it("creates multiple named series dynamically for source-backed compatible symptoms", async () => {
    const record = await fixture();
    const original = record.observations.find((o) => o.id === "m16-obs-eye_pain");
    if (!original) throw new Error("Missing fixture");
    const text = "Druga težava je 4 na lestvici od 0 do 10.";
    record.turns.push({ id: "dynamic-turn", callId: "m16", sequence: 50, speaker: "patient", occurredAt: original.observedAt, text });
    record.observations.push({ ...original, id: "dynamic-observation", symptomKey: "another_symptom", displayName: "Druga težava", sourceTurnId: "dynamic-turn", originalStatement: text, reportedSeverity: original.reportedSeverity ? { ...original.reportedSeverity, value: 4 } : null });
    const data = buildSymptomEvolution(record, asOf, "all");
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.series.map((s) => s.name).sort()).toEqual(["Bolečina v očesu", "Druga težava"]);
    const dynamicSeries = data.series.find((s) => s.symptomKey === "another_symptom");
    if (!dynamicSeries) throw new Error("Missing dynamic series");
    expect(data.rows.find((r) => r.day === "2026-11-16")?.points[dynamicSeries.id]?.id).toBe("dynamic-observation");
  });
  it("traces every numerical chart point to the exact stored observation and source statement", async () => {
    const record = await fixture();
    const data = buildSymptomEvolution(record, asOf, "all");
    const points = data.rows.flatMap((row) => Object.values(row.points).filter((point) => point !== null));
    expect(points).toHaveLength(5);
    for (const row of data.rows) for (const series of data.series) {
      const point = row.points[series.id];
      if (!point) continue;
      expect(record.observations.find((o) => o.id === point.id)).toEqual(point);
      expect(row.values[series.id]).toBe(point.reportedSeverity?.value);
      expect(record.turns.find((t) => t.id === point.sourceTurnId)?.text).toBe(point.originalStatement);
    }
  });
  it("uses missing observations as null gaps and preserves genuine reported zeroes", async () => {
    const marija = buildSymptomEvolution(await fixture(), asOf, "all");
    const series = marija.series[0];
    if (!series) throw new Error("Missing series");
    expect(marija.rows.find((r) => r.day === "2026-11-18")?.values[series.id]).toBeNull();
    const franc = buildSymptomEvolution(await fixture("p2"), asOf, "all");
    const pain = franc.series[0];
    if (!pain) throw new Error("Missing series");
    expect(franc.rows.find((r) => r.day === "2026-11-20")?.values[pain.id]).toBeNull();
    expect(franc.rows.find((r) => r.day === "2026-11-21")?.values[pain.id]).toBe(0);
  });
  it("separates incompatible bounds and scale meanings rather than comparing them", async () => {
    const record = await fixture();
    const latest = record.observations.find((o) => o.id === "c4-obs-eye_pain");
    if (!latest?.reportedSeverity) throw new Error("Missing score");
    latest.reportedSeverity.scale = { min: 0, max: 100, label: "Druga lestvica 0–100" };
    const data = buildSymptomEvolution(record, asOf, "all");
    expect(data.groups).toHaveLength(2);
    expect(data.symptoms.find((s) => s.key === "eye_pain")?.state).toBe("insufficient");
    expect(compareObservations(record.observations.find((o) => o.id === "c3-obs-eye_pain"), latest)).toBeNull();
    latest.reportedSeverity.scale = { min: 0, max: 10, label: "Drugačen pomen lestvice" };
    expect(buildSymptomEvolution(record, asOf, "all").groups).toHaveLength(2);
  });
  it("shows qualitative evidence and newly reported symptoms without inventing scores or disappearance", async () => {
    const data = buildSymptomEvolution(await fixture(), asOf, "all");
    const nausea = data.symptoms.find((s) => s.key === "nausea");
    expect(nausea?.state).toBe("new");
    expect(nausea?.qualitative).toHaveLength(1);
    expect(nausea?.series).toHaveLength(0);
    expect(data.symptoms.find((s) => s.key === "fatigue")?.latest.id).toBe("m17-obs-fatigue");
  });
  it("shows worsening and improving existing histories without modifying conversations", async () => {
    const marija = buildSymptomEvolution(await fixture(), asOf, "all");
    const franc = buildSymptomEvolution(await fixture("p2"), asOf, "all");
    expect(marija.symptoms.find((s) => s.key === "eye_pain")?.change).toMatchObject({ delta: 4, state: "worsened" });
    expect(franc.symptoms.find((s) => s.key === "eye_pain")?.change).toMatchObject({ delta: -2, state: "improved" });
    expect(marija.symptoms.find((s) => s.key === "eye_pain")?.changes.find((c) => c.current.id === "c3-obs-eye_pain")?.change?.state).toBe("unchanged");
  });
  it.each([["7", "2026-11-15", 7], ["14", "2026-11-08", 14], ["30", "2026-10-23", 30], ["all", "2026-11-16", 6]] as const)("filters %s days inclusively at the snapshot date", async (period, start, days) => {
    const data = buildSymptomEvolution(await fixture(), asOf, period);
    expect(data.start).toBe(start);
    expect(data.end).toBe("2026-11-21");
    expect(data.rows).toHaveLength(days);
  });
  it("retains multiple same-day scores as separate source-linked points", async () => {
    const record = await fixture();
    const original = record.observations.find((o) => o.id === "c4-obs-eye_pain");
    if (!original?.reportedSeverity) throw new Error("Missing score");
    const text = "Zdaj je bolečina 6 na lestvici od 0 do 10.";
    record.turns.push({ id: "extra-source", callId: "c4", sequence: 90, speaker: "patient", occurredAt: "2026-11-21T10:08:00+01:00", text });
    record.observations.push({ ...original, id: "extra-obs", sourceTurnId: "extra-source", observedAt: "2026-11-21T10:08:00+01:00", originalStatement: text, reportedSeverity: { ...original.reportedSeverity, value: 6 } });
    const data = buildSymptomEvolution(record, asOf, "all");
    expect(data.rows.filter((r) => r.day === "2026-11-21").flatMap((r) => Object.values(r.points).map((o) => o?.id))).toEqual(["c4-obs-eye_pain", "extra-obs"]);
  });
  it("excludes invalid scores and rejects unsupported source evidence", async () => {
    const record = await fixture();
    const latest = record.observations.find((o) => o.id === "c4-obs-eye_pain");
    if (!latest?.reportedSeverity) throw new Error("Missing score");
    latest.reportedSeverity.value = 11;
    expect(buildSymptomEvolution(record, asOf, "all").series.flatMap((s) => s.observations).some((o) => o.id === latest.id)).toBe(false);
    latest.originalStatement = "Unsupported invented source";
    expect(buildSymptomEvolution(record, asOf, "all").observations.some((o) => o.id === latest.id)).toBe(false);
  });
});