import { Flame, Gauge } from "lucide-react";

const navItems = ["Dashboard", "Leads", "Settings"];

export function PowerexNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-fire">
            <Flame className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-black tracking-normal text-foreground">Powerex Fire</p>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Lead Command</p>
          </div>
        </div>

        <nav className="hidden items-center rounded-lg border border-border/80 bg-card px-1 py-1 shadow-sm md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="rounded-md px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold text-foreground shadow-sm">
          <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="hidden sm:inline">Live Ops</span>
        </div>
      </div>
    </header>
  );
}
