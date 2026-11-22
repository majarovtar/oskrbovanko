import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Phone, RefreshCw } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { logout, startPhoneCall } from "@/lib/api";

type CallButtonState = { status: "calling" | "started" | "error"; message: string };

function CallStatus({ state }: { state: CallButtonState | undefined }) {
  if (!state || state.status === "calling") return null;
  return (
    <p role="status" className={`mt-2 text-sm ${state.status === "error" ? "text-destructive" : "text-primary"}`}>
      {state.message}
    </p>
  );
}

type ApiPatient = { id: string; name: string; phone_number: string; call_time: string; consent: boolean };
type ApiVitals = { id: string; patient_id: string; pulse: number; spo2: number; measured_at: string };
type ApiCall = {
  id: string;
  patient_id: string;
  started_at: string;
  transcript: string;
  closing_answer: string;
  severity: string;
  severity_reasons: string[];
  vitals: { pulse: number; spo2: number; measured_at: string } | null;
};

const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "oskrbovem_dev_bearer";
const dateTime = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" });
};

async function getJson<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Neveljaven ali potekel žeton (401).");
    if (response.status === 403) throw new Error("Dostop ni dovoljen (403).");
    throw new Error(`Napaka API: ${response.status}`);
  }
  return (await response.json()) as T;
}

export const Route = createFileRoute("/zdravnik/pacienti")({
  head: () => pageHead("Pacienti · Zdravnik", "Pacienti iz zalednega sistema oskrbaVEM."),
  component: RealPatientsPage,
});

function PatientResults({ patient, token }: { patient: ApiPatient; token: string }) {
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [vitals, setVitals] = useState<ApiVitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      getJson<ApiCall[]>(`/patients/${encodeURIComponent(patient.id)}/calls`, token, controller.signal),
      getJson<ApiVitals[]>(`/patients/${encodeURIComponent(patient.id)}/vitals`, token, controller.signal),
    ])
      .then(([loadedCalls, loadedVitals]) => {
        if (!controller.signal.aborted) {
          setCalls(loadedCalls);
          setVitals(loadedVitals);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Podatkov ni bilo mogoče naložiti.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patient.id, token]);

  if (loading) return <p role="status" className="mt-3 text-sm text-muted-foreground">Nalagam klice in meritve ...</p>;
  if (error) return <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>;

  const latestVitals = vitals[0];
  return (
    <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-2">
      <section className="space-y-3">
        <h4 className="font-semibold">Zadnje meritve</h4>
        {latestVitals ? (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">{dateTime(latestVitals.measured_at)}</p>
            <div className="mt-2 flex gap-6">
              <div><div className="text-xs text-muted-foreground">Srčni utrip</div><div className="text-xl font-semibold">{latestVitals.pulse} <span className="text-sm font-normal">utr./min</span></div></div>
              <div><div className="text-xs text-muted-foreground">SpO₂</div><div className="text-xl font-semibold">{latestVitals.spo2} <span className="text-sm font-normal">%</span></div></div>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Ni shranjenih meritev.</p>}
      </section>
      <section className="space-y-3">
        <h4 className="font-semibold">Zadnji klici ({calls.length})</h4>
        {calls.length === 0 ? <p className="text-sm text-muted-foreground">Ni shranjenih klicev. Ko backend shrani klic, se bo prikazal tukaj.</p> : (
          <div className="space-y-2">
            {calls.slice(0, 5).map((call) => (
              <details key={call.id} className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">
                  {dateTime(call.started_at)} · {call.severity === "critical" ? "Kritično opozorilo" : "Opravljen klic"}
                </summary>
                {call.severity_reasons?.length > 0 && (
                  <p className="mt-2 text-sm text-destructive">{call.severity_reasons.join(" · ")}</p>
                )}
                {call.transcript ? (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium">Prepis pogovora</h5>
                    <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 font-sans text-sm">{call.transcript}</pre>
                  </div>
                ) : <p className="mt-2 text-sm text-muted-foreground">Prepis ni na voljo.</p>}
                {call.closing_answer && <p className="mt-2 text-sm"><strong>Zaključni odgovor:</strong> {call.closing_answer}</p>}
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RealPatientsPage() {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [callState, setCallState] = useState<Record<string, CallButtonState>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (import.meta.env.DEV) {
      const saved = sessionStorage.getItem(TOKEN_KEY) ?? "";
      setToken(saved);
      setInput(saved);
    }
    setChecked(true);
  }, []);

  async function callPatient(patient: ApiPatient) {
    setCallState((s) => ({ ...s, [patient.id]: { status: "calling", message: "Kličem ..." } }));
    try {
      await startPhoneCall(patient.id);
      setCallState((s) => ({
        ...s,
        [patient.id]: { status: "started", message: "Klic poteka. Ko se konča, kliknite Osveži za odgovore." },
      }));
    } catch (err) {
      setCallState((s) => ({
        ...s,
        [patient.id]: { status: "error", message: err instanceof Error ? err.message : "Klic ni uspel." },
      }));
    }
  }

  function signOut() {
    logout();
    navigate({ to: "/auth" });
  }

  useEffect(() => {
    if (!token || !import.meta.env.DEV) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getJson<ApiPatient[]>("/patients", token, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setPatients(result); })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Podatkov ni bilo mogoče naložiti.");
        setPatients([]);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, refreshKey]);

  function loadPatients() {
    const value = input.trim().replace(/^Bearer\s+/i, "");
    sessionStorage.setItem(TOKEN_KEY, value);
    setToken(value);
    setSelectedId(null);
    setRefreshKey((previous) => previous + 1);
    if (!value) { setPatients([]); setError("Vnesite testni JWT žeton."); }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Pacienti</h1>
          <p className="mt-1 text-sm text-muted-foreground">Podatki iz pravega zalednega sistema · samo razvojno okolje</p>
        </div>
        {token && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setRefreshKey((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted"><RefreshCw className="size-4" /> Osveži</button>
            <button type="button" onClick={signOut} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted"><LogOut className="size-4" /> Odjava</button>
          </div>
        )}
      </header>
      {!import.meta.env.DEV ? <p role="alert" className="rounded-xl border bg-card p-4">Povezava je trenutno omogočena le za lokalni razvoj. Prijavo bomo povezali pozneje.</p> : (
        <>
          {checked && !token && (
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <p className="font-semibold">Niste prijavljeni.</p>
              <Link to="/auth" className="inline-block rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground">Prijava za zdravnike</Link>
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer">Razvojni dostop z JWT</summary>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input aria-label="Testni JWT" type="password" autoComplete="off" placeholder="Testni JWT (access_token)" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2" value={input} onChange={(e) => setInput(e.target.value)} />
                  <button type="button" className="rounded-lg border px-4 py-2" onClick={loadPatients}>Naloži paciente</button>
                </div>
              </details>
            </section>
          )}
          {loading && <p role="status">Nalagam paciente ...</p>}
          {error && <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-destructive">{error}</p>}
          {!loading && token && !error && (
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="text-xl font-semibold">Pacienti iz API ({patients.length})</h2>
              {patients.length === 0 ? <p className="text-sm text-muted-foreground">Za ta račun ni povezanih pacientov.</p> : (
                <div className="divide-y">
                  {patients.map((patient) => (
                    <article key={patient.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="font-bold">{patient.name}</h3><p className="text-xs text-muted-foreground">Dnevni klic: {patient.call_time || "Ni določeno"} · {patient.phone_number}</p></div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={callState[patient.id]?.status === "calling"}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                            onClick={() => callPatient(patient)}
                          >
                            <Phone className="size-4" /> {callState[patient.id]?.status === "calling" ? "Kličem ..." : "Pokliči"}
                          </button>
                          <button type="button" aria-expanded={selectedId === patient.id} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" onClick={() => setSelectedId(selectedId === patient.id ? null : patient.id)}>
                            {selectedId === patient.id ? "Zapri" : "Klici in meritve"}
                          </button>
                        </div>
                      </div>
                      <CallStatus state={callState[patient.id]} />
                      {selectedId === patient.id && <PatientResults key={`${patient.id}-${refreshKey}`} patient={patient} token={token} />}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
