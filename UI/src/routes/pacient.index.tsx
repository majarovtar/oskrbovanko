import { createFileRoute } from "@tanstack/react-router";
import { RealPatientDashboard } from "@/components/dashboard/real-patient-dashboard";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/pacient/")({
  head: () => pageHead("Moj pregled", "oskrbaVEM: dnevni telefonski klic za pacienta."),
  component: () => <RealPatientDashboard />,
});
