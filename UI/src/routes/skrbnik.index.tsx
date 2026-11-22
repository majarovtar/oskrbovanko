import { createFileRoute } from "@tanstack/react-router";
import { RealGuardianDashboard } from "@/components/dashboard/real-guardian-dashboard";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/skrbnik/")({
  head: () => pageHead("Oskrbovanko", "Skrbniški pregled dejanskih podatkov iz oskrbaVEM."),
  component: RealGuardianDashboard,
});
