import { createFileRoute } from "@tanstack/react-router";
import { RealDoctorDashboard } from "@/components/dashboard/real-doctor-dashboard";
import { pageHead } from "@/lib/page-head";

// The real-data overview uses the same temporary test JWT as /zdravnik/pacienti.
// No fictional patients are shown on this route.
export const Route = createFileRoute("/zdravnik/")({
  head: () => pageHead("Pregled pacientov · Zdravnik", "Zdravniški pregled pacientov iz FastAPI."),
  component: RealDoctorDashboard,
});
