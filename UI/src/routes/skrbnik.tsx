import { createFileRoute, Outlet } from "@tanstack/react-router";
import { GuardianLayout } from "@/components/dashboard/layouts";
import { useRoleGuard } from "@/lib/use-role-guard";

export const Route = createFileRoute("/skrbnik")({ component: RoleLayout });

function RoleLayout() {
  const account = useRoleGuard("caregiver");
  return <GuardianLayout account={account}>{account ? <Outlet /> : <p role="status">Preverjam prijavo ...</p>}</GuardianLayout>;
}
