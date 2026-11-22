import { Link, useRouter } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MissingDoctorPatient() {
  return <section className="space-y-5 py-8"><ShieldAlert className="size-8 text-muted-foreground" /><h1 className="text-2xl font-bold">Pacient ni na voljo</h1><p className="text-muted-foreground">Pacienta ni med dostopnimi podatki.</p><Button asChild variant="outline"><Link to="/zdravnik"><ArrowLeft />Nazaj na pregled</Link></Button></section>;
}
export function DoctorDetailError() {
  const router = useRouter();
  const { reset } = useQueryErrorResetBoundary();
  return <section role="alert" className="space-y-5 py-8"><h1 className="text-2xl font-bold">Podatkov ni mogoče odpreti</h1><p className="text-muted-foreground">Podatki niso bili nadomeščeni z izmišljenimi zapisi.</p><div className="flex flex-wrap gap-3"><Button onClick={() => { reset(); void router.invalidate(); }}><RotateCcw />Poskusi znova</Button><Button asChild variant="outline"><Link to="/zdravnik"><ArrowLeft />Nazaj na pregled</Link></Button></div></section>;
}