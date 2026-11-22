import { createFileRoute } from "@tanstack/react-router";
import { GuardianDashboard } from "@/components/dashboard/guardian-dashboard";
import { pageHead } from "@/lib/page-head";
import { guardianOverviewQuery } from "@/lib/data/queries";
export const Route = createFileRoute("/skrbnik/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(guardianOverviewQuery()),
  head: () => pageHead("Oskrbovanko", "oskrbaVEM: počutje oskrbovanca, zadnji pogovor, spremembe simptomov in pomembna obvestila za skrbnike."),
  component: RoleOverview,
});
function RoleOverview() { return <GuardianDashboard />; }
