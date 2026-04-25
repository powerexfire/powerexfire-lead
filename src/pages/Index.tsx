import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ShieldCheck, Zap, Factory } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/powerex/AuthGate";
import { PowerexNavbar } from "@/components/powerex/PowerexNavbar";
import { LeadSearchForm } from "@/components/powerex/LeadSearchForm";
import { LeadsTable } from "@/components/powerex/LeadsTable";
import { StatusPanel } from "@/components/powerex/StatusPanel";
import { LeadMetrics } from "@/components/powerex/LeadMetrics";
import { SettingsPanel } from "@/components/powerex/SettingsPanel";
import type { Lead, LeadActivity, SearchQuery, StatusTone } from "@/components/powerex/types";

const initialStatus = "Ready to generate leads from live sources.";
const locationPattern = /^[a-zA-Z0-9\s,.'-]{2,120}$/;

type FunctionResponse = {
  success?: boolean;
  leads?: Lead[];
  queries?: SearchQuery[];
  error?: string;
};

const Index = () => (
  <AuthGate>
    {(session) => <PowerexDashboard session={session} />}
  </AuthGate>
);

function PowerexDashboard({ session }: { session: Session }) {
  const [industry, setIndustry] = useState("Warehouse");
  const [location, setLocation] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [queries, setQueries] = useState<SearchQuery[]>([]);
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");
  const [statusMessage, setStatusMessage] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const lastActionRef = useRef<(() => void) | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      document.documentElement.style.setProperty("--pointer-x", `${(event.clientX / window.innerWidth) * 100}%`);
      document.documentElement.style.setProperty("--pointer-y", `${(event.clientY / window.innerHeight) * 100}%`);
    };
    window.addEventListener("pointermove", handlePointer);
    return () => window.removeEventListener("pointermove", handlePointer);
  }, []);

  const loadActivity = useCallback(async () => {
    const { data, error } = await supabase
      .from("lead_activity")
      .select("id, action, industry, location, result_count, status, message, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) setActivity(data as LeadActivity[]);
  }, []);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const runAction = useCallback(async (body: Record<string, unknown>, loadingMessage: string) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setStatusTone("loading");
    setStatusMessage(loadingMessage);

    try {
      const { data, error } = await supabase.functions.invoke<FunctionResponse>("powerex-leads", { body });
      if (requestId !== requestIdRef.current) return null;

      if (error || data?.success === false) {
        const message = data?.error || error?.message || "Unable to complete the lead request.";
        setStatusTone("error");
        setStatusMessage(message);
        toast.error(message);
        return null;
      }

      return data ?? {};
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        void loadActivity();
      }
    }
  }, [loadActivity]);

  const generateLeads = useCallback(async () => {
    lastActionRef.current = generateLeads;
    const cleanLocation = location.trim();
    if (!locationPattern.test(cleanLocation)) {
      setStatusTone("error");
      setStatusMessage("Enter a valid city or area before generating leads.");
      toast.error("Valid location is required");
      return;
    }

    const data = await runAction({ action: "generate", industry, location: cleanLocation }, "Fetching leads...");
    if (!data) return;

    const liveLeads = normalizeClientLeads(data.leads ?? []);
    setLeads(liveLeads);
    setStatusTone("success");
    setStatusMessage(liveLeads.length ? `Generated and saved ${liveLeads.length} lead${liveLeads.length === 1 ? "" : "s"}.` : "Webhook completed, but no structured leads were returned. Try syncing saved leads.");
    toast.success("Lead generation completed");
  }, [industry, location, runAction]);

  const syncQueries = useCallback(async () => {
    lastActionRef.current = syncQueries;
    const data = await runAction({ action: "syncQueries" }, "Fetching search queries from Google Sheets...");
    if (!data) return;
    const sheetQueries = data.queries ?? [];
    setQueries(sheetQueries);
    setStatusTone("success");
    setStatusMessage(`Synced ${sheetQueries.length} search quer${sheetQueries.length === 1 ? "y" : "ies"}.`);
  }, [runAction]);

  const syncLeads = useCallback(async () => {
    lastActionRef.current = syncLeads;
    const data = await runAction({ action: "syncLeads" }, "Fetching leads from Google Sheets...");
    if (!data) return;
    const sheetLeads = normalizeClientLeads(data.leads ?? []);
    setLeads(sheetLeads);
    setStatusTone("success");
    setStatusMessage(`Synced ${sheetLeads.length} saved lead${sheetLeads.length === 1 ? "" : "s"}.`);
  }, [runAction]);

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard access was blocked by the browser.");
    }
  };

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) => [lead.name, lead.industry, lead.location, lead.phone, lead.email, lead.website].some((value) => value?.toLowerCase().includes(term)));
  }, [leads, searchTerm]);

  const exportCsv = () => {
    if (!leads.length) return;
    const headers = ["Name", "Industry", "Location", "Address", "Phone", "Email", "Website", "Google Maps Link"];
    const rows = leads.map((lead) => [lead.name, lead.industry, lead.location, lead.address ?? "", lead.phone ?? "", lead.email ?? "", lead.website ?? "", lead.mapsLink ?? ""]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `powerex-fire-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export ready");
  };

  const activeQuery = useMemo(() => {
    return queries.find((query) => query.industry?.toLowerCase().includes(industry.toLowerCase()) && query.location?.toLowerCase() === location.trim().toLowerCase());
  }, [industry, location, queries]);

  return (
    <div className="industrial-shell min-h-screen">
      <PowerexNavbar userEmail={session.user.email} />

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

        <StatusPanel
          tone={statusTone}
          message={activeQuery?.query ? `${statusMessage} Active query: ${activeQuery.query}` : statusMessage}
          queryCount={queries.length}
          leadCount={leads.length}
          onRetry={lastActionRef.current ?? undefined}
        />

        <LeadMetrics leads={leads} />

        <LeadsTable
          leads={filteredLeads}
          totalLeads={leads.length}
          isLoading={isLoading}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onSyncLeads={syncLeads}
          onExport={exportCsv}
          onCopy={copyValue}
        />

        <SettingsPanel userEmail={session.user.email} activity={activity} onRefreshActivity={loadActivity} isLoading={isLoading} />
      </main>
    </div>
  );
}

function normalizeClientLeads(input: Lead[]) {
  const seen = new Set<string>();
  return input.filter((lead) => {
    const key = [lead.name, lead.phone, lead.website].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default Index;
