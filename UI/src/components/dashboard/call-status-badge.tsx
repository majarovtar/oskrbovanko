import { cn } from "@/lib/utils";
import { callStatus, type CallStatus } from "@/lib/use-doctor-calls";
import type { ApiCall } from "@/lib/api";

const STYLE: Record<CallStatus, { label: string; className: string }> = {
  critical: { label: "Nujno", className: "bg-red-100 text-red-800" },
  check: { label: "Za preverit", className: "bg-orange-100 text-orange-800" },
  ok: { label: "Brez težav", className: "bg-emerald-100 text-emerald-800" },
};

export function CallStatusBadge({ call, className }: { call: ApiCall; className?: string }) {
  const status = STYLE[callStatus(call)];
  const flagged = call.answers.filter((a) => a.flag).length;
  return (
    <span className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold", status.className, className)}>
      {status.label}{callStatus(call) === "check" && flagged ? ` (${flagged})` : ""}
    </span>
  );
}
