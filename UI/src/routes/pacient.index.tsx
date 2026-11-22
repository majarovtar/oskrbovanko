import { createFileRoute } from "@tanstack/react-router";
import { PatientDashboard } from "@/components/dashboard/patient-dashboard";
import { patientOverviewQuery } from "@/lib/data/queries";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/pacient/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(patientOverviewQuery()),
  head: () => pageHead("Moj naslednji telefonski klic", "oskrbaVEM: naslednji dnevni telefonski klic, preprosti koraki in pomoč za paciente."),
  component: RoleOverview,
});
function RoleOverview() { return <PatientDashboard />; }
