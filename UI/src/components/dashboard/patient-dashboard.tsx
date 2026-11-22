import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, HeartPulse, LifeBuoy, MessageCircle, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { patientOverviewQuery } from "@/lib/data/queries";
import { PatientHelp } from "./patient-help";

const steps = [
  { icon: Phone, text: "Oglasite se na telefon." },
  { icon: MessageCircle, text: "Povejte, kako se počutite." },
  { icon: HeartPulse, text: "Po potrebi opravite meritev po navodilih." },
];

export function PatientDashboard() {
  const { data } = useSuspenseQuery(patientOverviewQuery());
  const [helpOpen, setHelpOpen] = useState(false);
  if (!data) return <section className="space-y-4"><h1 className="text-3xl font-bold">Dober dan!</h1><p>Podatki o vašem naslednjem klicu še niso na voljo.</p><PatientHelp /></section>;
  const nextDate = data.nextCall ? new Date(data.nextCall).toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Ljubljana" }) : null;
  const nextTime = data.nextCall ? new Date(data.nextCall).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Ljubljana" }) : null;
  return <div className="space-y-5">
    <header className="space-y-2"><h1 className="text-3xl font-bold sm:text-4xl">Dober dan, {data.patient.name}!</h1><p className="text-xl leading-relaxed">Vsak dan vas pokličemo in vprašamo, kako se počutite.</p></header>
    <section aria-labelledby="next-call-heading" className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft"><h2 id="next-call-heading" className="flex items-center gap-3 text-2xl font-bold"><CalendarClock className="size-8 text-secondary-foreground" />Naslednji klic</h2>
      {data.completedToday && <p className="flex items-start gap-2 text-xl font-semibold text-secondary-foreground"><CheckCircle2 className="mt-1 size-6 shrink-0" />Današnji pogovor je zaključen.</p>}
      {data.missedToday && <p className="text-xl font-semibold">Današnji klic je bil zamujen. Imejte telefon pri sebi za naslednji klic.</p>}
      {nextDate && nextTime ? <div><p className="text-2xl font-bold first-letter:uppercase">{nextDate}</p><p className="mt-1 text-4xl font-bold tabular-nums">ob {nextTime}</p></div> : <p className="text-xl">Termin naslednjega klica še ni na voljo.</p>}
      <p className="text-xl leading-relaxed">Poklicali vas bomo po telefonu. Ni vam treba odpirati aplikacije.</p>
      {data.source === "fictional_demo" && <p className="text-base text-muted-foreground">Demo urnik · stanje na {new Date(data.asOf).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Ljubljana" })}{data.scheduleSource === "monitoring_plan" ? " · naslednji termin po dnevnem načrtu" : ""}</p>}
    </section>
    <section aria-labelledby="steps-heading" className="space-y-3"><h2 id="steps-heading" className="text-2xl font-bold">Kako poteka klic?</h2><ol className="grid gap-4 sm:grid-cols-3">{steps.map((step, index) => <li key={step.text} className="flex items-center gap-3 sm:block"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><step.icon className="size-7" /></span><p className="text-xl font-semibold leading-snug sm:mt-2"><span className="text-secondary-foreground">{index + 1}.</span> {step.text}</p></li>)}</ol></section>
    <section aria-labelledby="help-heading" className="space-y-3"><h2 id="help-heading" className="text-2xl font-bold">Pomoč in kontakt</h2><div className="grid gap-3 sm:grid-cols-2">{data.clinicPhone ? <Button asChild className="min-h-16 whitespace-normal rounded-xl bg-secondary text-xl font-bold text-secondary-foreground hover:bg-secondary/80"><a href={`tel:${data.clinicPhone}`}><Phone className="size-6" />Pokliči ambulanto</a></Button> : <Button disabled variant="outline" className="min-h-16 whitespace-normal rounded-xl bg-card text-xl font-bold disabled:opacity-70"><Phone className="size-6" />Pokliči ambulanto</Button>}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogTrigger asChild><Button variant="outline" className="min-h-16 rounded-xl bg-card text-xl font-bold"><LifeBuoy className="size-6" />Pomoč</Button></DialogTrigger><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl bg-card [&>button]:hidden"><DialogHeader><div className="flex items-center justify-between gap-3"><DialogTitle className="text-2xl">Pomoč pri telefonskem klicu</DialogTitle><Button size="icon" variant="ghost" className="size-12" aria-label="Zapri pomoč" onClick={() => setHelpOpen(false)}><X className="size-6" /></Button></div><DialogDescription className="sr-only">Kako poteka klic in kaj storiti, če ga zamudite.</DialogDescription></DialogHeader><PatientHelp /></DialogContent></Dialog>
    </div><p className="text-base leading-relaxed">{data.patient.clinicContact}{!data.clinicPhone ? " · Telefonska številka ambulante ni zabeležena. Uporabite številko iz svojih navodil." : ""}</p></section>
  </div>;
}