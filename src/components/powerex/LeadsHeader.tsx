import { FormEvent } from "react";
import { Loader2, Mail, MapPin, Phone, Search, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lead } from "./types";

const industries = ["Warehouse", "Factory", "Hospital", "Hotel", "Commercial Building", "Housing Societies", "Schools", "Colleges", "Restaurants", "Clinics"];
const locationPattern = /^[a-zA-Z0-9\s,.'-]{2,120}$/;

type LeadsHeaderProps = {
  industry: string;
  location: string;
  leads: Lead[];
  isLoading: boolean;
  onIndustryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSubmit: () => void;
};

export function LeadsHeader({
  industry,
  location,
  leads,
  isLoading,
  onIndustryChange,
  onLocationChange,
  onSubmit,
}: LeadsHeaderProps) {
  const trimmedLocation = location.trim();
  const locationError = trimmedLocation && !locationPattern.test(trimmedLocation) ? "Use 2-120 letters, numbers, spaces, commas, dots or hyphens." : "";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locationError) return;
    onSubmit();
  };

  const stats = [
    { label: "Leads", value: leads.length, icon: Users },
    { label: "With phone", value: leads.filter((lead) => Boolean(lead.phone)).length, icon: Phone },
    { label: "With email", value: leads.filter((lead) => Boolean(lead.email)).length, icon: Mail },
    { label: "Map-ready", value: leads.filter((lead) => Boolean(lead.mapsLink)).length, icon: MapPin },
    { label: "Needs review", value: leads.filter((lead) => !lead.phone && !lead.email).length, icon: ShieldAlert },
  ];

  return (
    <section aria-label="Lead dashboard header" className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-card-foreground">Lead Dashboard</h1>
          <p className="text-xs font-medium text-muted-foreground">Search, sync and track fire safety prospects</p>
        </div>
        <dl className="flex flex-wrap items-center gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5" title={stat.label}>
              <stat.icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <dt className="sr-only">{stat.label}</dt>
              <dd className="text-sm font-bold text-foreground">{stat.value}</dd>
              <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:inline">{stat.label}</span>
            </div>
          ))}
        </dl>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 px-4 py-3 sm:px-5 md:grid-cols-[200px_minmax(0,1fr)_auto] md:items-start" noValidate>
        <label className="grid gap-1.5 text-xs font-bold text-card-foreground">
          Industry
          <select
            value={industry}
            onChange={(event) => onIndustryChange(event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
            aria-label="Select target industry"
          >
            {industries.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-card-foreground">
          Location
          <input
            value={location}
            onChange={(event) => onLocationChange(event.target.value.slice(0, 120))}
            placeholder="City or area"
            aria-invalid={Boolean(locationError)}
            aria-describedby="location-help"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <span id="location-help" className={locationError ? "text-[11px] font-bold text-destructive" : "sr-only"}>
            {locationError || "Example: Thane, Mumbai, Pune MIDC"}
          </span>
        </label>

        <Button type="submit" variant="fire" size="sm" disabled={isLoading || Boolean(locationError)} className="h-9 w-full px-4 md:mt-[22px] md:w-auto">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          Generate Leads
        </Button>
      </form>
    </section>
  );
}
