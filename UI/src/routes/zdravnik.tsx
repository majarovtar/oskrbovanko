import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DoctorLayout } from "@/components/dashboard/layouts";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/zdravnik")({ component: RoleLayout });

function RoleLayout() {
  const navigate = useNavigate();
  // Zdravniške strani samo za prijavljene (žeton je v brskalniku, zato preverimo na odjemalcu).
  useEffect(() => {
    if (!getToken()) navigate({ to: "/auth" });
  }, [navigate]);
  return <DoctorLayout><Outlet /></DoctorLayout>;
}
