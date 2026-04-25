import { FormEvent } from "react";
import { Search, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const industries = ["Warehouse", "Factory", "Hospital", "Hotel", "Commercial Building"];
const locationPattern = /^[a-zA-Z0-9\s,.'-]{2,120}$/;

type LeadSearchFormProps = {
  industry: string;
  location: string;
  isLoading: boolean;
  onIndustryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSubmit: () => void;
  onSyncQueries: () => void;
};

export function LeadSearchForm({
  industry,
  location,
  isLoading,
  onIndustryChange,
  onLocationChange,
  onSubmit,
  onSyncQueries,
}: LeadSearchFormProps) {
  const trimmedLocation = location.trim();
  const locationError = trimmedLocation && !locationPattern.test(trimmedLocation) ? "Use 2-120 letters, numbers, spaces, commas, dots or hyphens." : "";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locationError) return;
    onSubmit();
  };

  return (
    <section id="dashboard" className="rounded-xl border border-border bg-card p-5 shadow-industrial sm:p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Lead Search</p>
          <h2 className="mt-2 text-2xl font-black text-card-foreground">Find fire safety prospects</h2>
        </div>
        <Button type="button" variant="steel" onClick={onSyncQueries} disabled={isLoading} aria-label="Sync search queries from Google Sheets">
          <RotateCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          Sync search queries
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-start" noValidate>
        <label className="grid gap-2 text-sm font-bold text-card-foreground">
          Industry
          <select
            value={industry}
            onChange={(event) => onIndustryChange(event.target.value)}
            className="h-12 rounded-lg border border-input bg-background px-4 text-base font-semibold text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
            aria-label="Select target industry"
          >
            {industries.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-card-foreground">
          Location
          <input
            value={location}
            onChange={(event) => onLocationChange(event.target.value.slice(0, 120))}
            placeholder="City or area"
            aria-invalid={Boolean(locationError)}
            aria-describedby="location-help"
            className="h-12 rounded-lg border border-input bg-background px-4 text-base font-semibold text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <span id="location-help" className={locationError ? "text-xs font-bold text-destructive" : "text-xs font-semibold text-muted-foreground"}>
            {locationError || "Example: Thane, Mumbai, Pune MIDC"}
          </span>
        </label>

        <Button type="submit" variant="fire" size="xl" disabled={isLoading || Boolean(locationError)} className="mt-0 w-full lg:mt-7 lg:w-auto">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
          Generate Leads
        </Button>
      </form>
    </section>
  );
}
