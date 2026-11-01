import { AlertTriangle, CheckCircle2, DatabaseZap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StatusTone } from "./types";

type StatusBarProps = {
  tone: StatusTone;
  message: string;
  onRetry?: () => void;
};

const toneClass: Record<StatusTone, string> = {
  idle: "border-border bg-card text-card-foreground",
  loading: "border-primary/30 bg-accent text-accent-foreground",
  success: "border-success/30 bg-success/10 text-success",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

const iconMap: Record<StatusTone, typeof DatabaseZap> = {
  idle: DatabaseZap,
  loading: DatabaseZap,
  success: CheckCircle2,
  error: AlertTriangle,
};

export function StatusBar({ tone, message, onRetry }: StatusBarProps) {
  if (tone === "idle") return null;
  const Icon = iconMap[tone];

  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${toneClass[tone]}`} role="status" aria-live="polite">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate" title={message}>{message}</span>
      {tone === "error" && onRetry ? (
        <Button type="button" variant="table" size="sm" onClick={onRetry} className="h-7 shrink-0 px-2">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
