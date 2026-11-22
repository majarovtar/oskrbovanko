import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/dashboard/layouts";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/zdravnik/opozorila")({
  head: () => pageHead("Opozorila · Zdravnik", "Opozorila: predstavitvena stran za vlogo zdravnik v oskrbaVEM."),
  component: PlaceholderPage,
});
function PlaceholderPage() { return <PhasePlaceholder title="Opozorila" />; }
