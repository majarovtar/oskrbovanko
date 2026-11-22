import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DoctorLayout } from "@/components/dashboard/layouts";
export const Route = createFileRoute("/zdravnik")({ component: RoleLayout });
function RoleLayout() { return <DoctorLayout><Outlet /></DoctorLayout>; }
