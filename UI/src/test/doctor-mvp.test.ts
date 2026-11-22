import { expect, it } from "vitest";
import { createDemoRepository } from "@/lib/data/repository";
import { DEMO_DOCTOR_ID } from "@/lib/data/demo-data";
import { selectRecentPatientCalls } from "@/lib/data/patient-detail";
import { buildSymptomEvolution } from "@/lib/data/symptom-evolution";

it("limits the recent-call projection to five newest calls without deleting history", async () => {
  const record = await createDemoRepository(DEMO_DOCTOR_ID).getPatientRecord("p1");
  if (!record) throw new Error("Missing demo patient");
  const before = structuredClone(record);
  const recent = selectRecentPatientCalls(record);
  expect(recent).toHaveLength(5);
  expect(recent.map((call) => call.id)).toEqual(["c4", "c3", "c2", "c1", "m17"]);
  expect(record).toEqual(before);
  expect(record.calls).toHaveLength(6);
});

it("projects exactly the last seven calendar days for the compact chart", async () => {
  const record = await createDemoRepository(DEMO_DOCTOR_ID).getPatientRecord("p1");
  if (!record) throw new Error("Missing demo patient");
  const data = buildSymptomEvolution(record, "2026-11-21T11:00:00+01:00", "7");
  expect(data.start).toBe("2026-11-15");
  expect(data.end).toBe("2026-11-21");
  expect(data.rows).toHaveLength(7);
});