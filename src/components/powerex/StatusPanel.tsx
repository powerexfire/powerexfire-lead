import { AlertTriangle, CheckCircle2, Clock3, DatabaseZap } from "lucide-react";
import type { StatusTone } from "./types";

type StatusPanelProps = {
  tone: StatusTone;
  message: string;
  queryCount: number;
  leadCount: number;
};

const iconMap = {
  idle: Clock3,
  loading: DatabaseZap,
  success: CheckCircle2,
  error: AlertTriangle,
};

export function StatusPanel({ tone, message, queryCount, leadCount }: StatusPanelProps) {
  const Icon = iconMap[tone];

  return (
    <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
      <div className={`status-panel status-panel-${tone}`} role="status" aria-live="polite">
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="font-bold">{message}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Queries</p>
          <p className="mt-2 text-3xl font-black text-foreground">{queryCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Leads</p>
          <p className="mt-2 text-3xl font-black text-foreground">{leadCount}</p>
        </div>
      </div>
    </section>
  );
}
