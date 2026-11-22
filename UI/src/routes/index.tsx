import { createFileRoute, redirect } from "@tanstack/react-router";

// Vstop v aplikacijo je prijava; po prijavi zdravnik pride na /zdravnik.
// (Predstavitveni pregled za skrbnike je še vedno na /skrbnik.)
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
