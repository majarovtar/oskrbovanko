import { useState } from "react";
import { Phone } from "lucide-react";
import { startPhoneCall } from "@/lib/api";

type State = { status: "idle" | "calling" | "started" | "error"; message: string };

/** Gumb "Pokliči": backend prek Twilio pokliče pacienta in odgovore shrani v bazo. */
export function CallButton({ patientId }: { patientId: string }) {
  const [state, setState] = useState<State>({ status: "idle", message: "" });

  async function call() {
    setState({ status: "calling", message: "" });
    try {
      await startPhoneCall(patientId);
      setState({ status: "started", message: "Klic poteka. Ko se konča, kliknite Osveži za odgovore." });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Klic ni uspel." });
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={call}
        disabled={state.status === "calling"}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Phone className="size-4" /> {state.status === "calling" ? "Kličem ..." : "Pokliči"}
      </button>
      {state.message && (
        <p role="status" className={`max-w-xs text-right text-xs ${state.status === "error" ? "text-destructive" : "text-primary"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
