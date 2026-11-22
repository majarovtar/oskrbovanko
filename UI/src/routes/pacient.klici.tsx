import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/dashboard/layouts";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/pacient/klici")({
  head: () => pageHead("Moji klici · Pacient", "Moji klici: predstavitvena stran za vlogo pacient v oskrbaVEM."),
  component: PlaceholderPage,
});
function PlaceholderPage() { return <PhasePlaceholder title="Moji klici" />; }
