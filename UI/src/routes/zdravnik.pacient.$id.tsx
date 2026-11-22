import { createFileRoute, notFound } from "@tanstack/react-router";
import { DoctorPatientDetail, type DetailSearch } from "@/components/dashboard/doctor-patient-detail";
import { DoctorDetailError, MissingDoctorPatient } from "@/components/dashboard/detail-states";
import { doctorOverviewQuery } from "@/lib/data/queries";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/zdravnik/pacient/$id")({
  validateSearch: (input: Record<string, unknown>): DetailSearch => ({
    ...(typeof input["call"] === "string" && input["call"] ? { call: input["call"] } : {}),
    ...(input["transcript"] === true || input["transcript"] === "true" ? { transcript: true } : {}),
    ...(typeof input["source"] === "string" && input["source"] ? { source: input["source"] } : {}),
    ...(input["period"] === "7" || input["period"] === 7 ? { period: "7" as const } : input["period"] === "14" || input["period"] === 14 ? { period: "14" as const } : input["period"] === "30" || input["period"] === 30 ? { period: "30" as const } : input["period"] === "all" ? { period: "all" as const } : {}),
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(doctorOverviewQuery());
    const patient = data.patients.find((p) => p.patient.id === params.id);
    if (!patient) throw notFound();
    return { name: patient.patient.name };
  },
  head: ({ loaderData }) => pageHead(loaderData ? `${loaderData.name} · Podrobni zdravniški pregled` : "Pacient ni na voljo", "oskrbaVEM: zadnji povzetek, zdravstvene meritve, razvoj simptomov in nedavni AI klici."),
  component: PatientDetailPage,
  errorComponent: DoctorDetailError,
  notFoundComponent: MissingDoctorPatient,
});

function PatientDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return <DoctorPatientDetail patientId={id} search={search} />;
}