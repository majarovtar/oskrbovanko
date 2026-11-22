import { createFileRoute } from "@tanstack/react-router";
import { RealPatientDashboard } from "@/components/dashboard/real-patient-dashboard";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/pacient/klici")({
  head: () => pageHead("Moji klici", "oskrbaVEM: zgodovina shranjenih telefonskih pogovorov."),
  component: () => <RealPatientDashboard historyOnly />,
});
