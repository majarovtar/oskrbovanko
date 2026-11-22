import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { DoctorDetailError, MissingDoctorPatient } from "@/components/dashboard/detail-states";

export const Route = createFileRoute("/zdravnik/pacienti_/$patientId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/zdravnik/pacient/$id", params: { id: params.patientId }, statusCode: 301, replace: true });
  },
  head: () => pageHead("Preusmeritev na pacienta", "Podrobni zdravniški pogled pacienta v oskrbaVEM."),
  errorComponent: DoctorDetailError,
  notFoundComponent: MissingDoctorPatient,
});