import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/dashboard/layouts";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/skrbnik/klici")({
  head: () => pageHead("Zgodovina klicev · Skrbnik", "Zgodovina klicev: predstavitvena stran za vlogo skrbnik v oskrbaVEM."),
  component: PlaceholderPage,
});
function PlaceholderPage() { return <PhasePlaceholder title="Zgodovina klicev" />; }
