import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/dashboard/layouts";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/zdravnik/klici")({
  head: () => pageHead("Klici in poročila · Zdravnik", "Klici in poročila: predstavitvena stran za vlogo zdravnik v oskrbaVEM."),
  component: PlaceholderPage,
});
function PlaceholderPage() { return <PhasePlaceholder title="Klici in poročila" />; }
