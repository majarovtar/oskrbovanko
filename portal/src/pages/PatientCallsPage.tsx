import { Link, useParams } from "react-router-dom";

import { CallCard } from "../components/CallCard";
import { ErrorPage } from "../components/ErrorPage";
import { usePatient } from "../hooks/usePatient";
import { usePatientCalls } from "../hooks/usePatientCalls";
import styles from "./PatientCallsPage.module.css";

export function PatientCallsPage() {
  const { id } = useParams<{ id: string }>();
  const { patient, error: patientError, loading: patientLoading } = usePatient(id ?? "");
  const { calls, error: callsError, loading: callsLoading } = usePatientCalls(id ?? "");

  const error = patientError ?? callsError;

  return (
    <div>
      <Link className={styles.back} to="/">
        &larr; Patients
      </Link>

      {(patientLoading || callsLoading) && <p>Loading...</p>}
      {error && <ErrorPage message={error.message} />}

      {patient && <h1>{patient.name}</h1>}

      {calls && calls.length === 0 && <p>No calls yet</p>}
      {calls && calls.map((call) => <CallCard call={call} key={call.id} />)}
    </div>
  );
}
