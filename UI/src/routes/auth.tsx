import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, HeartPulse, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_BY_ROLE, isRole, login, logout } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Prijava — Oskrbovanko" },
      { name: "description", content: "Prijava v portal Oskrbovanko za skrbnike in zdravstveno osebje." },
      { property: "og:title", content: "Prijava — Oskrbovanko" },
      { property: "og:description", content: "Prijava v portal Oskrbovanko za skrbnike in zdravstveno osebje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Prijavna stran vedno zahteva novo prijavo: morebitno prejšnjo sejo odjavimo.
  useEffect(() => {
    logout();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") {
      setSent(true);
      return;
    }
    // Prava prijava prek FastAPI (/auth/login); vsaka vloga gre na svojo domačo stran.
    setError("");
    setBusy(true);
    try {
      const account = await login(email.trim(), password);
      if (isRole(account.role)) {
        navigate({ to: HOME_BY_ROLE[account.role] });   // zdravnik, skrbnik ali pacient
      } else {
        logout();
        setError("Ta račun nima dostopa do portala.");
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 401 ? "Napačen e-poštni naslov ali geslo." : err instanceof Error ? err.message : "Prijava ni uspela.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 font-sans">
      <div className="w-full max-w-md">
        {/* Logotip */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
            <HeartPulse className="size-7" />
          </span>
          <span className="font-display text-3xl font-bold text-primary">
            oskrba<span className="text-foreground">VEM</span>
          </span>
          <p className="text-sm text-muted-foreground">Portal za skrbnike in zdravstveno osebje</p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-soft sm:p-8">
          {mode === "login" ? (
            <>
              <h1 className="font-display text-2xl font-bold">Prijava</h1>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                Vpišite se za pregled dnevnih klicev in opozoril vaših oskrbovancev.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <Field label="E-pošta" icon={Mail}>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ime@primer.si"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </Field>
                <Field label="Geslo" icon={Lock}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Skrij geslo" : "Pokaži geslo"}
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </Field>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setSent(false); }}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Pozabljeno geslo?
                  </button>
                </div>
                {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Prijavljam ..." : "Prijava"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold">Ponastavitev gesla</h1>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                Vnesite e-poštni naslov in poslali vam bomo povezavo za ponastavitev gesla.
              </p>
              {sent ? (
                <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
                  Če račun s tem naslovom obstaja, smo poslali povezavo za ponastavitev. Preverite pošto.
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <Field label="E-pošta" icon={Mail}>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ime@primer.si"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </Field>
                  <button
                    type="submit"
                    className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft transition hover:opacity-90"
                  >
                    Pošlji povezavo
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="mt-4 w-full text-center text-sm font-semibold text-primary hover:underline"
              >
                Nazaj na prijavo
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nimate računa? Obračun in dostop uredi vaša ambulanta ali izvajalec oskrbe.
        </p>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <span className={cn("flex items-center gap-3 rounded-2xl border bg-background px-4 py-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30")}>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        {children}
      </span>
    </label>
  );
}
