import { AlertTriangle, CheckCircle2, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, type ApiAnswer, type ApiCall, type Flag } from "@/lib/api";
import { callStatus } from "@/lib/use-doctor-calls";

// Barve oznak: rdeče = nujno, oranžno = naj pogleda zdravnik, rumeno = manjša težava.
export const FLAG_STYLE: Record<Flag, { label: string; badge: string; row: string; bubble: string }> = {
  high: { label: "Nujno", badge: "bg-red-100 text-red-800 border-red-200", row: "border-l-red-500 bg-red-50", bubble: "bg-red-100 border-red-300 text-red-950" },
  medium: { label: "Pozor", badge: "bg-orange-100 text-orange-800 border-orange-200", row: "border-l-orange-400 bg-orange-50", bubble: "bg-orange-100 border-orange-300 text-orange-950" },
  low: { label: "Opomba", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", row: "border-l-yellow-400 bg-yellow-50", bubble: "bg-yellow-50 border-yellow-300 text-yellow-950" },
};
const FLAG_ORDER: Record<Flag, number> = { high: 0, medium: 1, low: 2 };

const REASON_LABELS: Record<string, string> = {
  high_flag: "Zaskrbljujoč odgovor v klicu",
  emergency_phrase: "Nujna fraza v pogovoru",
  spo2_low: "Nizka nasičenost s kisikom",
  pulse_out_of_range: "Utrip izven običajnih meja",
};

export function reasonLabels(reasons: string[] | undefined): string[] {
  return (reasons ?? []).filter((r) => !r.startsWith("ana")).map((r) => REASON_LABELS[r] ?? r);
}

export function FlagBadge({ flag }: { flag: Flag | null }) {
  if (!flag) return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">V redu</span>;
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", FLAG_STYLE[flag].badge)}>{FLAG_STYLE[flag].label}</span>;
}

function answerText(value: ApiAnswer["value"]): string {
  if (value === null || value === undefined || value === "") return "(ni odgovora)";
  return String(value);
}

export function flaggedAnswers(call: ApiCall): (ApiAnswer & { flag: Flag })[] {
  return call.answers
    .filter((a): a is ApiAnswer & { flag: Flag } => a.flag !== null)
    .sort((a, b) => FLAG_ORDER[a.flag] - FLAG_ORDER[b.flag]);
}

type Line = { speaker: "agent" | "patient"; text: string; time?: string };

/** Prepis "AGENT: ..." / "PACIENT: ..." (lahko s časom "[10:02:03] AGENT: ...") razdeli v vrstice. */
export function parseTranscript(transcript: string): Line[] {
  const lines: Line[] = [];
  for (const raw of transcript.split("\n")) {
    const match = raw.match(/^\s*(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?(AGENT|PACIENT|ASISTENTKA|ANA)\s*:\s*(.*)$/i);
    if (match) {
      const speaker = (match[2] ?? "").toUpperCase() === "PACIENT" ? "patient" : "agent";
      lines.push({ speaker, text: match[3] ?? "", ...(match[1] ? { time: match[1] } : {}) });
    } else if (raw.trim() && lines.length > 0) {
      const last = lines[lines.length - 1];
      if (last) last.text += ` ${raw.trim()}`;
    }
  }
  return lines;
}

/** Pogovor kot klepet; pacientovi odgovori, ki kažejo težavo, so obarvani. */
export function TranscriptChat({ call }: { call: ApiCall }) {
  const lines = parseTranscript(call.transcript ?? "");
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">Prepis ni na voljo.</p>;
  const flagByQuestion = new Map(call.answers.map((a) => [a.question.text.trim(), a.flag]));
  let lastQuestion = "";
  return (
    <ol className="space-y-2" aria-label="Prepis pogovora">
      {lines.map((line, i) => {
        if (line.speaker === "agent") {
          lastQuestion = line.text.trim();
          return (
            <li key={i} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-muted/60 px-3 py-2 text-sm">
                <span className="mb-0.5 block text-xs font-semibold text-muted-foreground">Asistentka{line.time ? ` · ${line.time}` : ""}</span>
                {line.text}
              </div>
            </li>
          );
        }
        const flag = flagByQuestion.get(lastQuestion) ?? null;
        return (
          <li key={i} className="flex justify-end">
            <div className={cn("max-w-[85%] rounded-2xl rounded-tr-sm border px-3 py-2 text-sm", flag ? FLAG_STYLE[flag].bubble : "border-primary/20 bg-primary/10")}>
              <span className="mb-0.5 flex items-center justify-end gap-2 text-xs font-semibold text-muted-foreground">
                {flag && <FlagBadge flag={flag} />}Pacient{line.time ? ` · ${line.time}` : ""}
              </span>
              {line.text || <em className="text-muted-foreground">(ni odgovora)</em>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Za skrbnika: preprost povzetek klica in nasvet, kaj storiti (brez prepisa in strokovnih izrazov). */
export function GuardianCallSummary({ call, patientName }: { call: ApiCall; patientName: string }) {
  const flagged = flaggedAnswers(call);
  const critical = callStatus(call) === "critical";
  const advice = critical
    ? `Zdravnik je o klicu že obveščen in bo poskrbel za nadaljnje korake. Če se ${patientName} počuti slabše ali opazite nenadne težave, takoj pokličite 112.`
    : flagged.length
      ? `Priporočamo, da danes pokličete ali obiščete ${patientName} in preverite spodnje stvari. Če se stanje poslabša, pokličite ambulanto.`
      : `${patientName} v klicu ni omenil(a) težav. Nič vam ni treba narediti.`;

  return (
    <div className="space-y-4">
      <div className={cn("flex items-start gap-3 rounded-xl border p-4", critical ? "border-red-300 bg-red-50" : flagged.length ? "border-orange-300 bg-orange-50" : "border-emerald-300 bg-emerald-50")}>
        {critical || flagged.length ? <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", critical ? "text-red-600" : "text-orange-600")} /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />}
        <div>
          <p className="font-semibold">{critical ? "Nujno" : flagged.length ? "Nekaj stvari je dobro preveriti" : "Vse v redu"}</p>
          <p className="text-sm">{advice}</p>
        </div>
      </div>

      {flagged.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Na kaj bodite pozorni</h3>
          <ul className="space-y-2">
            {flagged.map((a) => (
              <li key={a.question.text} className={cn("rounded-lg border border-l-4 p-3 text-sm", FLAG_STYLE[a.flag].row)}>
                <span className="text-muted-foreground">{a.question.text}</span>
                <p className="font-medium">»{answerText(a.value)}«</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {call.answers.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Vsi odgovori iz klica</h3>
          <ul className="space-y-1.5">
            {call.answers.map((a, i) => (
              <li key={i} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border border-l-4 p-3 text-sm", a.flag ? FLAG_STYLE[a.flag].row : "border-l-emerald-400")}>
                <div>
                  <p className="text-muted-foreground">{a.question.text}</p>
                  <p className="font-medium">{answerText(a.value)}</p>
                </div>
                <FlagBadge flag={a.flag} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Celotno poročilo o klicu: kaj je lahko narobe, odgovori po vprašanjih in prepis. */
export function CallReport({ call, showTranscript = false }: { call: ApiCall; showTranscript?: boolean }) {
  const flagged = flaggedAnswers(call);
  const reasons = reasonLabels(call.severity_reasons);
  const critical = callStatus(call) === "critical";

  return (
    <div className="space-y-5">
      <div className={cn("flex items-start gap-3 rounded-xl border p-4", critical ? "border-red-300 bg-red-50" : flagged.length ? "border-orange-300 bg-orange-50" : "border-emerald-300 bg-emerald-50")}>
        {critical || flagged.length ? <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", critical ? "text-red-600" : "text-orange-600")} /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />}
        <div>
          <p className="font-semibold">
            {critical ? "Nujno: klic kaže znake, ki jih je treba takoj preveriti." : flagged.length ? `V klicu je ${flagged.length} odgovor(ov), ki jih je dobro preveriti.` : "V odgovorih ni znakov za skrb."}
          </p>
          <p className="text-sm text-muted-foreground">Klic {formatDateTime(call.started_at)}{reasons.length ? ` · ${reasons.join(" · ")}` : ""}</p>
        </div>
      </div>

      {flagged.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Kaj je lahko narobe</h3>
          <ul className="space-y-2">
            {flagged.map((a) => (
              <li key={a.question.text} className={cn("rounded-lg border border-l-4 p-3", FLAG_STYLE[a.flag].row)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{a.question.text}</span>
                  <FlagBadge flag={a.flag} />
                </div>
                <p className="mt-1 font-medium">»{answerText(a.value)}«</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {call.answers.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Odgovori po vprašanjih</h3>
          <div className="divide-y rounded-lg border">
            {call.answers.map((a, i) => (
              <div key={i} className="grid gap-1 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-3">
                <span className="text-sm text-muted-foreground">{i + 1}. {a.question.text}</span>
                <span className="text-sm font-medium">{answerText(a.value)}</span>
                <FlagBadge flag={a.flag} />
              </div>
            ))}
          </div>
        </section>
      )}

      {showTranscript && (
        <details className="rounded-lg border p-3" open={call.answers.length === 0}>
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><MessageSquareText className="size-4 text-primary" /> Prepis pogovora</summary>
          <div className="mt-3"><TranscriptChat call={call} /></div>
        </details>
      )}
    </div>
  );
}
