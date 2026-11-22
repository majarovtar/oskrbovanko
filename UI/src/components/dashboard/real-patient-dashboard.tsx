import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, HelpCircle, Phone, RefreshCw, MessageCircle, HeartPulse, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { apiGet, formatDateTime, type ApiCall, type ApiPatient } from "@/lib/api";

type PatientInfo = { patient: ApiPatient; calls: ApiCall[] };

/** Pacient: dnevni klic in moji pogovori (podatki prijavljenega pacienta). */
export function RealPatientDashboard({ historyOnly = false }: { historyOnly?: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const [info, setInfo] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setInfo(null);
    (async () => {
      const patients = await apiGet<ApiPatient[]>("/patients", controller.signal);
      const patient = patients[0];
      if (!patient) throw new Error("Z vašim računom še ni povezan pacient. Pokličite ambulanto.");
      const calls = await apiGet<ApiCall[]>(`/patients/${encodeURIComponent(patient.id)}/calls`, controller.signal);
      if (!controller.signal.aborted) setInfo({ patient, calls: [...calls].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)) });
    })().catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Podatkov ni bilo mogoče pridobiti.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todaysCall = info?.calls.some(c => !Number.isNaN(Date.parse(c.started_at)) && new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(c.started_at)) === today);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>{historyOnly ? <><Button asChild variant="ghost" className="mb-3 min-h-12 text-lg"><Link to="/pacient"><ArrowLeft />Nazaj</Link></Button><h1 className="text-3xl font-bold">Moji klici</h1></> : <><h1 className="text-3xl font-bold sm:text-4xl">{info ? `Dober dan, ${info.patient.name}!` : "Dober dan!"}</h1><p className="mt-2 text-xl leading-relaxed">Poklicali vas bomo po telefonu in vas vprašali, kako se počutite.</p></>}</div>
      <Button variant="outline" onClick={() => setRefresh(v => v + 1)} disabled={loading}><RefreshCw className="mr-2 size-4"/>Osveži</Button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-base text-destructive">{error}</p>}
    {loading && <p role="status">Nalagam podatke …</p>}
    {info && (historyOnly ? <section className="space-y-3 rounded-2xl border bg-card p-5">
      {info.calls.length ? info.calls.slice(0, 10).map(c => <details key={c.id} className="rounded-xl border p-4">
        <summary className="cursor-pointer text-lg font-semibold">{formatDateTime(c.started_at)}</summary>
        {c.answers.length ? <dl className="mt-3 space-y-3">{c.answers.map((a, i) => <div key={i}><dt className="text-base text-muted-foreground">{a.question.text}</dt><dd className="text-lg">{a.value === null || a.value === "" ? "(ni odgovora)" : String(a.value)}</dd></div>)}</dl> : <p className="mt-2 text-base text-muted-foreground">Pogovor je shranjen.</p>}
      </details>) : <p className="text-xl">Za zdaj še ni shranjenih pogovorov.</p>}
    </section> : <>
      <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="next-call-title">
        <h2 id="next-call-title" className="flex items-center gap-3 text-2xl font-bold"><CalendarClock className="size-8 text-primary"/>Dnevni telefonski klic</h2>
        <p className="text-xl">Predvidena ura klica</p>
        <p className="text-4xl font-bold tabular-nums">{info.patient.call_time || "Ni podatka"}</p>
        <p className="text-lg text-muted-foreground">To je običajna ura klica. Naslednji termin še ni posebej potrjen.</p>
        {todaysCall ? <p className="flex items-center gap-2 text-xl font-semibold"><CheckCircle2 className="size-6 text-primary"/>Danes je bil shranjen pogovor.</p> : <p className="text-xl">Za danes še ni shranjenega pogovora.</p>}
        <p className="text-xl leading-relaxed">Poklicali vas bomo na običajen telefon. Aplikacije ni treba odpirati.</p>
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-bold">Kako poteka klic?</h2><div className="grid gap-3 sm:grid-cols-3">{[{icon:Phone,text:"Oglasite se na telefon."},{icon:MessageCircle,text:"Povejte, kako se počutite."},{icon:HeartPulse,text:"Po potrebi opravite meritev."}].map((s,i) => <div key={s.text} className="rounded-xl border bg-card p-4"><s.icon className="mb-3 size-8 text-primary"/><p className="text-xl font-semibold">{i+1}. {s.text}</p></div>)}</div></section>
      <section className="grid gap-3 sm:grid-cols-2"><Button asChild variant="outline" className="min-h-16 rounded-xl text-lg"><Link to="/pacient/klici"><Phone className="size-5"/>Moji klici</Link></Button><Button asChild variant="outline" className="min-h-16 rounded-xl text-lg"><Link to="/pacient/pomoc"><HelpCircle className="size-5"/>Pomoč</Link></Button></section>
      <p className="text-base text-muted-foreground">Telefonska številka ambulante v trenutnem API-ju še ni na voljo. Za nujno pomoč uporabite številko 112.</p>
    </>)}
  </div>;
}
