import { useEffect, useState } from "react";

import { fetchPatientCalls, type Call } from "../api/patients";

export interface UsePatientCallsResult {
  calls: Call[] | null;
  error: Error | null;
  loading: boolean;
}

export function usePatientCalls(id: string): UsePatientCallsResult {
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPatientCalls(id)
      .then((result) => {
        if (!cancelled) setCalls(result);
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

  return { calls, error, loading };
}
