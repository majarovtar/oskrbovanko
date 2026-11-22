import { queryOptions } from "@tanstack/react-query";
import { DEMO_GUARDIAN_ID, DEMO_DOCTOR_ID } from "./demo-data";
import { createDemoRepository } from "./repository";
import { loadGuardianPatients } from "./guardian-adapter";
import { loadDoctorOverview } from "./doctor-overview";
import { loadGuardianOverview } from "./guardian-overview";
import { loadPatientOverview } from "./patient-overview";

// Explicit fixture source: no automatic fallback from a failed/unauthorized persistent read.
// No hosted backend is connected. Replace the implementation only after server identity/RLS exist.
export const guardianPatientsQuery = () => queryOptions({
  queryKey: ["clinical-data", "fictional-demo", "guardian", DEMO_GUARDIAN_ID],
  queryFn: () => loadGuardianPatients(createDemoRepository(DEMO_GUARDIAN_ID)),
  staleTime: Infinity,
});

export const createDoctorRepository = () => createDemoRepository(DEMO_DOCTOR_ID);
export const createGuardianRepository = () => createDemoRepository(DEMO_GUARDIAN_ID);
export const guardianOverviewQuery = () => queryOptions({
  queryKey: ["clinical-data", "fictional-demo", "guardian-overview", DEMO_GUARDIAN_ID],
  queryFn: () => loadGuardianOverview(createGuardianRepository()),
  staleTime: Infinity,
});

export const doctorOverviewQuery = () => queryOptions({
  queryKey: ["clinical-data", "fictional-demo", "doctor", DEMO_DOCTOR_ID],
  queryFn: () => loadDoctorOverview(createDoctorRepository()),
  staleTime: Infinity,
});

// Explicit fictional self identity; this is not login or production authorization.
export const patientOverviewQuery = () => queryOptions({
  queryKey: ["clinical-data", "fictional-demo", "patient", "demo-marija"],
  queryFn: () => loadPatientOverview(createDemoRepository("demo-marija")),
  staleTime: Infinity,
});
