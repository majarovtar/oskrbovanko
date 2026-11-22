import { useEffect, useState } from "react";
import { apiGet, type ApiCall, type ApiPatient } from "@/lib/api";

export type PatientCall = { patient: ApiPatient; call: ApiCall; isLatest: boolean };
export type CallStatus = "critical" | "check" | "ok";

/** Stanje klica: nujno (critical ali rdeč odgovor), za preverit (vsaj en označen odgovor) ali v redu. */
export function callStatus(call: ApiCall): CallStatus {
  if (call.severity === "critical" || call.answers.some((a) => a.flag === "high")) return "critical";
  return call.answers.some((a) => a.flag) ? "check" : "ok";
}

/** Vsi klici vseh pacientov prijavljenega zdravnika, najnovejši najprej. */
export function useDoctorCalls(refresh = 0) {
  const [items, setItems] = useState<PatientCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      const patients = await apiGet<ApiPatient[]>("/patients", controller.signal);
      const perPatient = await Promise.all(patients.map(async (patient) => {
        const calls = await apiGet<ApiCall[]>(`/patients/${encodeURIComponent(patient.id)}/calls`, controller.signal);
        const sorted = [...calls].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
        return sorted.map((call, i) => ({ patient, call, isLatest: i === 0 }));
      }));
      const all = perPatient.flat().sort((a, b) => Date.parse(b.call.started_at) - Date.parse(a.call.started_at));
      if (!controller.signal.aborted) setItems(all);
    })()
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Podatkov ni bilo mogoče naložiti."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  return { items, loading, error };
}
