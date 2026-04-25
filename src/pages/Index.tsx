import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Zap, Factory } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PowerexNavbar } from "@/components/powerex/PowerexNavbar";
import { LeadSearchForm } from "@/components/powerex/LeadSearchForm";
import { LeadsTable } from "@/components/powerex/LeadsTable";
import { StatusPanel } from "@/components/powerex/StatusPanel";
import type { Lead, SearchQuery, StatusTone } from "@/components/powerex/types";

const initialStatus = "Ready to generate leads from live sources.";

type FunctionResponse = {
  success?: boolean;
  leads?: Lead[];
  queries?: SearchQuery[];
  error?: string;
};

const Index = () => {
  const [industry, setIndustry] = useState("Warehouse");
  const [location, setLocation] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [queries, setQueries] = useState<SearchQuery[]>([]);
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");
  const [statusMessage, setStatusMessage] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      document.documentElement.style.setProperty("--pointer-x", `${(event.clientX / window.innerWidth) * 100}%`);
      document.documentElement.style.setProperty("--pointer-y", `${(event.clientY / window.innerHeight) * 100}%`);
    };
    window.addEventListener("pointermove", handlePointer);
    return () => window.removeEventListener("pointermove", handlePointer);
  }, []);

  const runAction = useCallback(async (body: Record<string, unknown>, loadingMessage: string) => {
    setIsLoading(true);
    setStatusTone("loading");
    setStatusMessage(loadingMessage);

    const { data, error } = await supabase.functions.invoke<FunctionResponse>("powerex-leads", { body });

    if (error || data?.success === false) {
      const message = data?.error || error?.message || "Unable to complete the lead request.";
      setStatusTone("error");
      setStatusMessage(message);
      toast.error(message);
      setIsLoading(false);
      return null;
    }

    setIsLoading(false);
    return data ?? {};
  }, []);

  const generateLeads = async () => {
    const cleanLocation = location.trim();
    if (!cleanLocation) {
      setStatusTone("error");
      setStatusMessage("Enter a city or area before generating leads.");
      toast.error("Location is required");
      return;
    }

    const data = await runAction({ action: "generate", industry, location: cleanLocation }, "Fetching leads...");
    if (!data) return;

    const liveLeads = data.leads ?? [];
    setLeads(liveLeads);
    setStatusTone("success");
    setStatusMessage(liveLeads.length ? `Generated and saved ${liveLeads.length} lead${liveLeads.length === 1 ? "" : "s"}.` : "Webhook completed, but no structured leads were returned.");
    toast.success("Lead generation completed");
  };

  const syncQueries = async () => {
    const data = await runAction({ action: "syncQueries" }, "Fetching search queries from Google Sheets...");
    if (!data) return;
    const sheetQueries = data.queries ?? [];
    setQueries(sheetQueries);
    setStatusTone("success");
    setStatusMessage(`Synced ${sheetQueries.length} search quer${sheetQueries.length === 1 ? "y" : "ies"}.`);
  };

  const syncLeads = async () => {
    const data = await runAction({ action: "syncLeads" }, "Fetching leads from Google Sheets...");
    if (!data) return;
    const sheetLeads = data.leads ?? [];
    setLeads(sheetLeads);
    setStatusTone("success");
    setStatusMessage(`Synced ${sheetLeads.length} saved lead${sheetLeads.length === 1 ? "" : "s"}.`);
  };

  const copyValue = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const activeQuery = useMemo(() => {
    return queries.find((query) => query.industry?.toLowerCase() === industry.toLowerCase() && query.location?.toLowerCase() === location.trim().toLowerCase());
  }, [industry, location, queries]);

  return (
    <div className="industrial-shell min-h-screen">
      <PowerexNavbar />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-xl bg-hero-industrial text-secondary-foreground shadow-industrial">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div className="animate-rise-in">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-secondary-foreground/20 bg-secondary-foreground/10 px-3 py-2 text-sm font-black uppercase tracking-[0.2em] text-secondary-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Fire Safety Prospecting
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                Powerex Fire Lead Generation Dashboard
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-secondary-foreground/82 sm:text-lg">
                Collect industry and location inputs, trigger the Powerex n8n workflow, and keep live Google Sheets lead records organized for follow-up.
              </p>
            </div>

            <div className="grid content-end gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { icon: Factory, label: "Industrial targeting", value: industry },
                { icon: Zap, label: "Workflow", value: "n8n webhook" },
                { icon: ShieldCheck, label: "Storage", value: "Google Sheets" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-secondary-foreground/18 bg-secondary-foreground/10 p-4 backdrop-blur-md transition-transform hover:-translate-y-1">
                  <item.icon className="mb-4 h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-secondary-foreground/65">{item.label}</p>
                  <p className="mt-2 text-lg font-black text-secondary-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LeadSearchForm
          industry={industry}
          location={location}
          isLoading={isLoading}
          onIndustryChange={setIndustry}
          onLocationChange={setLocation}
          onSubmit={generateLeads}
          onSyncQueries={syncQueries}
        />

        <StatusPanel tone={statusTone} message={activeQuery?.query ? `${statusMessage} Active query: ${activeQuery.query}` : statusMessage} queryCount={queries.length} leadCount={leads.length} />

        <LeadsTable leads={leads} isLoading={isLoading} onSyncLeads={syncLeads} onCopy={copyValue} />
      </main>
    </div>
  );
};

export default Index;
