import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Headphones, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PatientRecord, MonitoringCall, ConversationTurn } from "@/lib/data/models";
import { detailTimestamp, loadAuthorizedRecording } from "@/lib/data/patient-detail";
import { createDoctorRepository } from "@/lib/data/queries";
import { cn } from "@/lib/utils";

export function DoctorConversation({ turns, patientName, simulated }: {
  turns: ConversationTurn[]; patientName: string; simulated: boolean;
}) {
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">{simulated ? "Simuliran prepis · izmišljeni pogovor, ne prepis posnetka" : "Prepis pogovora"}</p>
    {turns.length ? <ol aria-label="Celoten prepis pogovora" className="max-h-80 space-y-3 overflow-y-auto overscroll-contain">{turns.map((turn) => <li key={turn.id} data-turn-id={turn.id} className={cn("rounded-lg p-3", turn.speaker === "ai" ? "mr-4 bg-muted" : "ml-4 bg-success-soft")}><div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground"><span className="flex items-center gap-1.5 font-bold">{turn.speaker === "ai" ? <Bot className="size-3.5" /> : <UserRound className="size-3.5" />}{turn.speaker === "ai" ? "AI asistent" : patientName}</span><time dateTime={turn.occurredAt}>{detailTimestamp(turn.occurredAt)}</time></div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{turn.text}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">Za ta klic ni prepisa pogovora.</p>}
  </div>;
}

export function DoctorRecording({ record, call }: { record: PatientRecord; call: MonitoringCall }) {
  const [playbackError, setPlaybackError] = useState(false);
  const recording = useMutation({ mutationFn: () => loadAuthorizedRecording(createDoctorRepository(), record, call.id) });
  const unavailable = !record.patient.recordingConsent || !call.recording || call.provenance === "fictional_demo";
  return <section className="space-y-3 border-t pt-5" aria-labelledby="recording-heading"><h3 id="recording-heading" className="flex items-center gap-2 font-bold"><Headphones className="size-4 text-primary" />Zvočni posnetek</h3>{unavailable ? <p className="text-sm text-muted-foreground">{!record.patient.recordingConsent ? "Soglasje za snemanje ni podano. Zvočni posnetek ni na voljo." : call.provenance === "fictional_demo" ? "Zvočni posnetek ni na voljo. Prikazan je jasno označen simuliran pogovor." : "Zvočni posnetek ni na voljo."}</p> : <>
    {!recording.data && <Button variant="outline" disabled={recording.isPending} onClick={() => { setPlaybackError(false); recording.mutate(); }}><Headphones />{recording.isPending ? "Preverjanje dostopa …" : "Odpri dovoljen posnetek"}</Button>}
    {recording.data && <><p className="text-xs text-muted-foreground">Dostop do dejanskega posnetka je preverjen. Povezava je časovno omejena.</p><audio className="w-full" controls preload="none" src={recording.data.url} aria-label="Dovoljen zvočni posnetek pogovora" onError={() => setPlaybackError(true)} />{playbackError && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Posnetka ni mogoče predvajati. Dostop je morda potekel.</p><Button variant="outline" onClick={() => { setPlaybackError(false); recording.reset(); recording.mutate(); }}>Ponovno preveri dostop</Button></div>}</>}
    {recording.isSuccess && !recording.data && <p role="status" className="text-sm text-muted-foreground">Dovoljen posnetek ni na voljo.</p>}
    {recording.isError && <p role="alert" className="text-sm text-destructive">Dostopa ni mogoče preveriti. Posnetek ni bil odprt.</p>}
  </>}</section>;
}