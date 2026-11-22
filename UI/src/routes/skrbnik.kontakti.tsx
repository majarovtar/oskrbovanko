import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/dashboard/layouts";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/skrbnik/kontakti")({
  head: () => pageHead("Kontakti · Skrbnik", "Kontakti: predstavitvena stran za vlogo skrbnik v oskrbaVEM."),
  component: PlaceholderPage,
});
function PlaceholderPage() { return <PhasePlaceholder title="Kontakti" />; }
