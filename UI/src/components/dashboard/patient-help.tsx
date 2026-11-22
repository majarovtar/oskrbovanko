import { Phone, PhoneMissed } from "lucide-react";

export function PatientHelp() {
  return <div className="space-y-5 text-xl leading-relaxed"><div className="flex items-start gap-3"><Phone className="mt-1 size-7 shrink-0 text-secondary-foreground" /><p>AI asistent vas pokliče na vaš običajni telefon in vas vpraša, kako se počutite. Oglasite se in odgovorite s svojimi besedami. Aplikacije ni treba odpirati.</p></div><div className="flex items-start gap-3"><PhoneMissed className="mt-1 size-7 shrink-0 text-secondary-foreground" /><p>Če klic zamudite, imejte telefon pri sebi za naslednji klic. Če potrebujete pomoč ali vas skrbi počutje, pokličite ambulanto na številko iz svojih navodil.</p></div></div>;
}