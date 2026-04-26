import { Activity, CheckCircle2, Database, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadActivity } from "./types";

type SettingsPanelProps = {
  userEmail?: string;
  userId?: string;
  activity: LeadActivity[];
  onRefreshActivity: () => void;
  onSignOut: () => void;
  isLoading: boolean;
};

export function SettingsPanel({ userEmail, userId, activity, onRefreshActivity, onSignOut, isLoading }: SettingsPanelProps) {
  return (
    <section id="settings" className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-xl border border-border bg-card p-5 shadow-industrial sm:p-6">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Settings</p>
        <h2 className="mt-2 text-2xl font-black text-card-foreground">Production controls</h2>
        <div className="mt-6 grid gap-3">
          {[
            { icon: ShieldCheck, label: "Access", value: userEmail ?? "Authenticated user" },
            { icon: UserCog, label: "User management", value: userId ? `Current user: ${userId.slice(0, 8)}…` : "Managed by secure authentication" },
            { icon: Database, label: "Storage", value: "Google Sheets via secure server function" },
            { icon: CheckCircle2, label: "Validation", value: "Client and server-side input checks" },
          ].map((item) => (
            <div key={item.label} className="flex gap-3 rounded-lg border border-border bg-background p-4">
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-black text-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-medium leading-5 text-muted-foreground">{item.value}</p>
              </div>
            </div>
          ))}
          <Button type="button" variant="fire" onClick={onSignOut} className="mt-2 justify-self-start">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-industrial sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Audit Trail</p>
            <h2 className="mt-2 text-2xl font-black text-card-foreground">Recent activity</h2>
          </div>
          <Button type="button" variant="steel" onClick={onRefreshActivity} disabled={isLoading}>
            <Activity className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        <div className="mt-5 grid gap-3" aria-live="polite">
          {activity.length === 0 ? (
            <div className="rounded-lg border border-border bg-background p-5 text-sm font-semibold text-muted-foreground">
              No activity has been recorded yet.
            </div>
          ) : (
            activity.slice(0, 6).map((item) => (
              <div key={item.id} className="grid gap-2 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-black text-foreground">{item.action} · {item.status}</p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{item.message || `${item.result_count} records`} </p>
                </div>
                <time className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground" dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
