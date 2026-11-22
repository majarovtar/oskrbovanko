import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Bell, ClipboardList, HeartPulse, House, LifeBuoy, LogOut, Menu, Phone, Stethoscope, Users, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout, type Account } from "@/lib/api";

type DemoView = "zdravnik" | "skrbnik" | "pacient";
const labels = { zdravnik: "Zdravnik", skrbnik: "Skrbnik", pacient: "Pacient" };
const navigation = {
  zdravnik: [
    { to: "/zdravnik", label: "Pregled", icon: House },
    { to: "/zdravnik/pacienti", label: "Pacienti", icon: Users },
    { to: "/zdravnik/opozorila", label: "Opozorila", icon: Bell },
    { to: "/zdravnik/klici", label: "Klici in poročila", icon: ClipboardList },
  ],
  // Skrbnik ima vse na eni strani (/skrbnik), zato menija ne potrebuje.
  skrbnik: [],
  pacient: [
    { to: "/pacient", label: "Domov", icon: House },
    { to: "/pacient/klici", label: "Moji klici", icon: Phone },
    { to: "/pacient/pomoc", label: "Pomoč", icon: LifeBuoy },
  ],
} as const;

function DashboardLayout({ view, account, children }: { view: DemoView; account: Account | null; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const signOut = () => { logout(); navigate({ to: "/auth" }); };
  return (
    <div className="min-h-screen font-sans">
      <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:block focus:bg-card focus:p-3 focus:text-primary">Preskoči na vsebino</a>
      <header className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:justify-between">
          <Link to={view === "zdravnik" ? "/zdravnik" : view === "pacient" ? "/pacient" : "/skrbnik"} className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><HeartPulse className="size-5" /></span>
            <span className="font-display text-2xl font-bold text-primary">oskrba<span className="text-foreground">VEM</span></span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground sm:block">{labels[view]}</span>
            {account && <span className="hidden items-center gap-2 text-sm font-semibold md:flex"><span className="grid size-8 place-items-center rounded-full bg-secondary text-primary"><Users className="size-4" /></span>{account.name}</span>}
            <Button variant="ghost" className="min-h-11 rounded-full" onClick={signOut}><LogOut className="size-4" /><span className="hidden sm:inline">Odjava</span><span className="sr-only sm:hidden">Odjava</span></Button>
            {navigation[view].length > 0 && <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:hidden" aria-label={menuOpen ? "Zapri meni" : "Odpri meni"} aria-expanded={menuOpen} aria-controls="role-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>}
          </div>
        </div>
        {navigation[view].length > 0 && <nav id="role-navigation" aria-label={`Navigacija: ${labels[view]}`} className={cn("mx-auto max-w-6xl gap-2 px-4 pb-4 md:flex", menuOpen ? "grid" : "hidden")}>
          {navigation[view].map((item) => <Button key={item.to} asChild variant="ghost" className="min-h-11 justify-start rounded-full px-4"><Link to={item.to} activeOptions={{ exact: true }} activeProps={{ className: "bg-secondary text-secondary-foreground font-bold", "aria-current": "page" }} inactiveProps={{ className: "text-foreground" }} onClick={() => setMenuOpen(false)}><item.icon />{item.label}</Link></Button>)}
        </nav>}
      </header>
      <main id="dashboard-content" className={cn("mx-auto max-w-6xl space-y-8 px-4 py-8", view === "pacient" && "max-w-4xl space-y-4 py-4 text-xl")}>
        {children}
      </main>
    </div>
  );
}
type LayoutProps = { account?: Account | null; children: ReactNode };
export function DoctorLayout({ account = null, children }: LayoutProps) { return <DashboardLayout view="zdravnik" account={account}>{children}</DashboardLayout>; }
export function GuardianLayout({ account = null, children }: LayoutProps) { return <DashboardLayout view="skrbnik" account={account}>{children}</DashboardLayout>; }
export function PatientLayout({ account = null, children }: LayoutProps) { return <DashboardLayout view="pacient" account={account}>{children}</DashboardLayout>; }

export function PhasePlaceholder({ title, icon: Icon = Stethoscope }: { title: string; icon?: LucideIcon }) {
  return <section className="space-y-6"><h1 className="font-display text-3xl font-bold">{title}</h1><div className="flex min-h-64 flex-col items-center justify-center gap-4 border-y border-dashed py-12 text-center"><span className="grid size-16 place-items-center rounded-full bg-secondary text-primary"><Icon className="size-8" /></span><h2 className="text-xl font-semibold">V pripravi</h2></div></section>;
}
