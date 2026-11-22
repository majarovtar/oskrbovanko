import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PatientLayout } from "@/components/dashboard/layouts";
export const Route = createFileRoute("/pacient")({ component: RoleLayout });
function RoleLayout() { return <PatientLayout><Outlet /></PatientLayout>; }
