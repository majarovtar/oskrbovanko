import { useEffect, useState } from "react";

import { fetchPatient, type Patient } from "../api/patients";

export interface UsePatientResult {
  patient: Patient | null;
  error: Error | null;
  loading: boolean;
}

export function usePatient(id: string): UsePatientResult {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPatient(id)
      .then((result) => {
        if (!cancelled) setPatient(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { patient, error, loading };
}
