import { createFileRoute } from "@tanstack/react-router";
import { GuardianLayout } from "@/components/dashboard/layouts";
import { GuardianDashboard } from "@/components/dashboard/guardian-dashboard";
import { pageHead } from "@/lib/page-head";
import { guardianOverviewQuery } from "@/lib/data/queries";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(guardianOverviewQuery()),
  head: () => pageHead("Oskrbovanko — portal za skrbnike", "Predstavitveni pregled dnevnih klicev, vitalnih znakov in opozoril za oskrbovance."),
  component: LegacyGuardianPage,
});
function LegacyGuardianPage() { return <GuardianLayout><GuardianDashboard /></GuardianLayout>; }
