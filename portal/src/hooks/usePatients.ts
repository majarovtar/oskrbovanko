import { useEffect, useState } from "react";

import { fetchPatients, type Patient } from "../api/patients";

export interface UsePatientsResult {
  patients: Patient[] | null;
  error: Error | null;
  loading: boolean;
}

export function usePatients(): UsePatientsResult {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPatients()
      .then((result) => {
        if (!cancelled) setPatients(result);
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
  }, []);

  return { patients, error, loading };
}
