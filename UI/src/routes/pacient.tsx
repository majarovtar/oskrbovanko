import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PatientLayout } from "@/components/dashboard/layouts";
import { useRoleGuard } from "@/lib/use-role-guard";

export const Route = createFileRoute("/pacient")({ component: RoleLayout });

function RoleLayout() {
  const account = useRoleGuard("patient");
  return <PatientLayout account={account}>{account ? <Outlet /> : <p role="status">Preverjam prijavo ...</p>}</PatientLayout>;
}
