import { Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import type { Lead } from "./types";

type LeadMetricsProps = {
  leads: Lead[];
};

export function LeadMetrics({ leads }: LeadMetricsProps) {
  const metrics = [
    { label: "With phone", value: leads.filter((lead) => Boolean(lead.phone)).length, icon: Phone },
    { label: "With email", value: leads.filter((lead) => Boolean(lead.email)).length, icon: Mail },
    { label: "Map-ready", value: leads.filter((lead) => Boolean(lead.mapsLink)).length, icon: MapPin },
    { label: "Needs review", value: leads.filter((lead) => !lead.phone && !lead.email).length, icon: ShieldAlert },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Lead quality metrics">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5">
          <metric.icon className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="mt-4 text-3xl font-black text-foreground">{metric.value}</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </section>
  );
}
