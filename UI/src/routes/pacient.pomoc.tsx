import { createFileRoute } from "@tanstack/react-router";
import { PatientHelp } from "@/components/dashboard/patient-help";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/pacient/pomoc")({
  head: () => pageHead("Pomoč pri telefonskem klicu", "oskrbaVEM: kako poteka AI telefonski klic in kaj storiti, če klic zamudite."),
  component: PlaceholderPage,
});
function PlaceholderPage() { return <section className="space-y-6"><Button asChild variant="ghost" className="min-h-12 text-lg"><Link to="/pacient"><ArrowLeft />Nazaj</Link></Button><h1 className="text-3xl font-bold">Pomoč</h1><PatientHelp /></section>; }
