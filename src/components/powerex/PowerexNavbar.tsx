import { Crown, Gauge, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePowerexWorkspace } from "./WorkspaceContext";
import type { AppRole } from "./types";

export function PowerexNavbar({ userEmail, onSignOut }: { userEmail?: string; onSignOut: () => void }) {
  const { currentRole } = usePowerexWorkspace();
  const role: AppRole = currentRole;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger
            className="rounded-lg border border-border bg-card p-2 text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </SidebarTrigger>
          <a href="/leads" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Powerex Fire leads home">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-fire">
              <Crown aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-black tracking-normal text-foreground">Powerex Fire</p>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Lead Command</p>
            </div>
          </a>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold text-foreground shadow-sm">
            {role === "admin" ? <Crown className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Gauge className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            <span className="hidden max-w-44 truncate sm:inline">{userEmail || "Live Ops"}</span>
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-black uppercase text-accent-foreground">{role}</span>
          </div>
          <Button type="button" variant="table" size="sm" onClick={onSignOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
