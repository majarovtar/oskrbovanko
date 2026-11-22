import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DoctorConversation } from "./doctor-conversation";
import { createGuardianRepository } from "@/lib/data/queries";
import { loadAuthorizedRecording } from "@/lib/data/patient-detail";
import type { GuardianOverviewPatient } from "@/lib/data/guardian-overview";

export function GuardianConversation({ patient }: { patient: GuardianOverviewPatient }) {
  const [open, setOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const { record, selected } = patient;
  const call = selected.call;
  const recording = useMutation({ mutationFn: () => call ? loadAuthorizedRecording(createGuardianRepository(), record, call.id) : Promise.resolve(null) });
  if (!call) return null;
  const available = record.patient.recordingConsent && call.recording && call.provenance === "backend";
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="rounded-full">Podrobnosti pogovora</Button></DialogTrigger><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl bg-card [&>button]:hidden"><DialogHeader><div className="flex items-start justify-between gap-3"><DialogTitle>Pogovor · {record.patient.name}</DialogTitle><Button variant="ghost" size="icon" aria-label="Zapri pogovor" onClick={() => setOpen(false)}>×</Button></div><DialogDescription>Celoten prepis zadnjega klica</DialogDescription></DialogHeader><DoctorConversation turns={selected.turns} patientName={record.patient.name} simulated={call.provenance === "fictional_demo"} /><div className="space-y-3 border-t pt-3"><h3 className="flex items-center gap-2 text-sm font-bold"><Headphones className="size-4 text-primary" />Zvočni posnetek</h3>{available ? <>
    {!recording.data && <Button variant="outline" disabled={recording.isPending} onClick={() => { setPlaybackError(false); recording.mutate(); }}>{recording.isPending ? "Preverjanje dostopa …" : "Odpri dovoljen posnetek"}</Button>}
    {recording.data && <audio controls preload="none" className="w-full" src={recording.data.url} aria-label="Dovoljen zvočni posnetek" onError={() => setPlaybackError(true)} />}
    {playbackError && <p role="alert" className="text-sm text-destructive">Posnetka ni mogoče predvajati. Ponovno preverite dostop.</p>}
    {playbackError && <Button variant="outline" onClick={() => { setPlaybackError(false); recording.reset(); recording.mutate(); }}>Ponovno preveri dostop</Button>}
    {recording.isError && <p role="alert" className="text-sm text-destructive">Dostopa ni mogoče preveriti. Posnetek ni bil odprt.</p>}
    {recording.isSuccess && !recording.data && <p className="text-sm text-muted-foreground">Dovoljen posnetek ni na voljo.</p>}
  </> : <p className="text-sm text-muted-foreground">{record.patient.recordingConsent ? "Zvočni posnetek ni na voljo." : "Soglasje za snemanje ni podano. Posnetek ni na voljo."}</p>}</div></DialogContent></Dialog>;
}