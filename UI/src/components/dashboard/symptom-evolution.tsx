import { useMemo } from "react";
import { Activity } from "lucide-react";
import type { PatientRecord } from "@/lib/data/models";
import { buildSymptomEvolution } from "@/lib/data/symptom-evolution";
import { cn } from "@/lib/utils";
import { SymptomLineChart, symptomSwatches } from "./symptom-chart";

export function SymptomEvolutionSection({ record, asOf }: { record: PatientRecord; asOf: string }) {
  const data = useMemo(() => buildSymptomEvolution(record, asOf, "7"), [record, asOf]);
  const main = data.symptoms.filter((symptom) => symptom.change).sort((a, b) => Math.abs(b.change?.delta ?? 0) - Math.abs(a.change?.delta ?? 0))[0];
  const before = main?.change?.previous.reportedSeverity;
  const after = main?.change?.current.reportedSeverity;
  return <section aria-labelledby="evolution-heading" className="min-w-0 space-y-3 border-y py-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="evolution-heading" className="flex items-center gap-2 text-xl font-bold"><Activity className="size-5 text-primary" />Razvoj simptomov</h2><span className="text-xs text-muted-foreground">Zadnjih 7 dni</span></div>
    {data.series.length ? <><div className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legenda simptomov">{data.series.map((series) => <span key={series.id} className="inline-flex items-center gap-2 text-xs"><span className={cn("h-0.5 w-5 shrink-0", symptomSwatches[series.colorIndex])} />{series.name}<span className="text-muted-foreground">{series.scale.min}–{series.scale.max}{data.groups.length > 1 ? ` · ${series.scale.label}` : ""}</span></span>)}</div><SymptomLineChart rows={data.rows} series={data.series} />
    <p className="text-sm font-semibold">{main && before && after ? `${main.name}: poročana jakost se je ${main.change?.delta === 0 ? "ohranila" : main.change && main.change.delta > 0 ? "povečala" : "zmanjšala"} (${before.value} → ${after.value}) med prvo in zadnjo primerljivo navedbo.` : "Za oceno spremembe še ni dovolj primerljivih navedb."}</p></> : <p className="py-5 text-sm text-muted-foreground">Za graf ni primerljivih številčnih ocen.</p>}
    {data.symptoms.filter((symptom) => symptom.qualitative.length > 0).map((symptom) => {
      const latest = symptom.qualitative.at(-1);
      return latest ? <p key={symptom.key} className="text-sm"><span className="font-semibold">{symptom.name}:</span> {latest.qualitativeDescription} <span className="text-xs text-muted-foreground">· brez številčne ocene</span></p> : null;
    })}
    <p className="text-xs text-muted-foreground">Pacientove navedbe, ne diagnoza. Vrzeli pomenijo manjkajoče ocene.{data.groups.length > 1 ? " Različne lestvice imajo ločene osi in niso neposredno primerljive." : ""}</p>
  </section>;
}
