import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DoctorLayout } from "@/components/dashboard/layouts";
import { useRoleGuard } from "@/lib/use-role-guard";

export const Route = createFileRoute("/zdravnik")({ component: RoleLayout });

function RoleLayout() {
  const account = useRoleGuard("doctor");
  return <DoctorLayout account={account}>{account ? <Outlet /> : <p role="status">Preverjam prijavo ...</p>}</DoctorLayout>;
}
