import { createFileRoute, Outlet } from "@tanstack/react-router";
import { GuardianLayout } from "@/components/dashboard/layouts";
export const Route = createFileRoute("/skrbnik")({ component: RoleLayout });
function RoleLayout() { return <GuardianLayout><Outlet /></GuardianLayout>; }
