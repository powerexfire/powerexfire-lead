import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Factory, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/powerex/AuthGate";
import { PowerexNavbar } from "@/components/powerex/PowerexNavbar";
import { LeadSearchForm } from "@/components/powerex/LeadSearchForm";
import { LeadsTable } from "@/components/powerex/LeadsTable";
import { StatusPanel } from "@/components/powerex/StatusPanel";
import { LeadMetrics } from "@/components/powerex/LeadMetrics";
import { SettingsPanel } from "@/components/powerex/SettingsPanel";
import type { AppRole, AppUser, Lead, LeadActivity, SearchQuery, StatusTone } from "@/components/powerex/types";

const initialStatus = "Ready to generate leads from live sources.";
const locationPattern = /^[a-zA-Z0-9\s,.'-]{2,120}$/;

type FunctionResponse = {
  success?: boolean;
  leads?: Lead[];
  queries?: SearchQuery[];
  users?: AppUser[];
  currentRole?: AppRole;
  savedCount?: number;
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
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentRole, setCurrentRole] = useState<AppRole>("user");
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");
  const [statusMessage, setStatusMessage] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(false);
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

  const runAction = useCallback(async (body: Record<string, unknown>, loadingMessage: string, options?: { silent?: boolean }) => {
    const requestId = ++requestIdRef.current;
    if (!options?.silent) {
      setIsLoading(true);
      setStatusTone("loading");
      setStatusMessage(loadingMessage);
    }

    try {
      const { data, error } = await supabase.functions.invoke<FunctionResponse>("powerex-leads", { body });
      if (requestId !== requestIdRef.current) return null;

      if (error || data?.success === false) {
        const message = data?.error || error?.message || "Unable to complete the lead request.";
        if (!options?.silent) {
          setStatusTone("error");
          setStatusMessage(message);
        }
        toast.error(message);
        return null;
      }

      return data ?? {};
    } finally {
      if (requestId === requestIdRef.current) {
        if (!options?.silent) setIsLoading(false);
        void loadActivity();
      }
    }
  }, [loadActivity]);

  const loadUsers = useCallback(async (silent = true) => {
    setIsUserLoading(true);
    try {
      const data = await runAction({ action: "getUsers" }, "Loading user management...", { silent });
      if (!data) return;
      setUsers(data.users ?? []);
      setCurrentRole(data.currentRole ?? "user");
    } finally {
      setIsUserLoading(false);
    }
  }, [runAction]);

  useEffect(() => {
    void loadActivity();
    void loadUsers(true);
  }, [loadActivity, loadUsers]);

  const generateLeads = useCallback(async () => {
    lastActionRef.current = generateLeads;
    const cleanLocation = location.trim();
    if (!locationPattern.test(cleanLocation)) {
      setStatusTone("error");
      setStatusMessage("Enter a valid city or area before generating leads.");
      toast.error("Valid location is required");
      return;
    }

    const data = await runAction({ action: "generate", industry, location: cleanLocation }, "Starting n8n workflow and checking the Data sheet...");
    if (!data) return;

    const liveLeads = normalizeClientLeads(data.leads ?? []);
    setLeads(liveLeads);
    setStatusTone("success");
    setStatusMessage(liveLeads.length ? `Generated ${liveLeads.length} matching lead${liveLeads.length === 1 ? "" : "s"}${data.savedCount ? ` and saved ${data.savedCount} new record${data.savedCount === 1 ? "" : "s"}` : ""}.` : "Workflow started successfully. No matching leads are available yet; use Sync leads again in a moment.");
    toast.success("Lead generation completed");
  }, [industry, location, runAction]);

  const syncQueries = useCallback(async () => {
    lastActionRef.current = syncQueries;
    const data = await runAction({ action: "syncQueries" }, "Fetching search queries from the Query sheet...");
    if (!data) return;
    const sheetQueries = data.queries ?? [];
    setQueries(sheetQueries);
    setStatusTone("success");
    setStatusMessage(`Synced ${sheetQueries.length} search quer${sheetQueries.length === 1 ? "y" : "ies"} from the Query tab.`);
  }, [runAction]);

  const syncLeads = useCallback(async () => {
    lastActionRef.current = syncLeads;
    const data = await runAction({ action: "syncLeads" }, "Fetching leads from the Data sheet...");
    if (!data) return;
    const sheetLeads = normalizeClientLeads(data.leads ?? []);
    setLeads(sheetLeads);
    setStatusTone("success");
    setStatusMessage(`Synced ${sheetLeads.length} saved lead${sheetLeads.length === 1 ? "" : "s"} from the Data tab.`);
  }, [runAction]);

  const assignRole = useCallback(async (email: string, role: AppRole) => {
    setIsUserLoading(true);
    try {
      const data = await runAction({ action: "setUserRole", email, role }, `Updating ${email}...`, { silent: true });
      if (!data) return;
      setUsers(data.users ?? []);
      setCurrentRole(data.currentRole ?? currentRole);
      toast.success(`${email} is now ${role === "admin" ? "an admin" : "a user"}.`);
    } finally {
      setIsUserLoading(false);
    }
  }, [currentRole, runAction]);

  const applyQuery = useCallback((query: SearchQuery) => {
    setIndustry(normalizeIndustry(query.industry || industry));
    setLocation(query.location || location);
    setStatusTone("idle");
    setStatusMessage(query.query ? `Loaded query: ${query.query}` : "Search query loaded.");
  }, [industry, location]);

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard access was blocked by the browser.");
    }
  };

  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out securely.");
  }, []);

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) => [lead.name, lead.industry, lead.location, lead.phone, lead.email, lead.website].some((value) => value?.toLowerCase().includes(term)));
  }, [leads, searchTerm]);

  const exportCsv = () => {
    if (!leads.length) return;
    const headers = ["Name", "Industry", "Location", "Address", "Phone", "Email", "Website", "Google Maps Link"];
    const rows = leads.map((lead) => [lead.name, lead.industry, lead.location, lead.address ?? "", lead.phone ?? "", lead.email ?? "", lead.website ?? "", lead.mapsLink ?? ""]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
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
    const targetIndustry = slug(industry);
    const targetLocation = slug(location);
    return queries.find((query) => slug(query.industry).includes(targetIndustry) && slug(query.location) === targetLocation);
  }, [industry, location, queries]);

  return (
    <div className="industrial-shell min-h-screen">
      <PowerexNavbar userEmail={session.user.email} role={currentRole} onSignOut={handleSignOut} />

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
                { icon: ShieldCheck, label: "Access", value: currentRole === "admin" ? "Admin" : "User" },
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
          queries={queries}
          isLoading={isLoading}
          onIndustryChange={setIndustry}
          onLocationChange={setLocation}
          onSubmit={generateLeads}
          onSyncQueries={syncQueries}
          onApplyQuery={applyQuery}
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

        <SettingsPanel
          userEmail={session.user.email}
          userId={session.user.id}
          currentRole={currentRole}
          users={users}
          activity={activity}
          onRefreshActivity={loadActivity}
          onRefreshUsers={() => loadUsers(false)}
          onRoleChange={assignRole}
          onSignOut={handleSignOut}
          isLoading={isLoading}
          isUserLoading={isUserLoading}
        />
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

function slug(value = "") {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizeIndustry(value: string) {
  const labels: Record<string, string> = {
    factories: "Factory",
    factory: "Factory",
    warehouses: "Warehouse",
    warehouse: "Warehouse",
    hospitals: "Hospital",
    hospital: "Hospital",
    hotels: "Hotel",
    hotel: "Hotel",
    commercial_buildings: "Commercial Building",
    commercial_building: "Commercial Building",
    housing_societies: "Housing Societies",
    schools: "Schools",
    colleges: "Colleges",
    restaurants: "Restaurants",
    clinics: "Clinics",
  };
  return labels[slug(value)] ?? value;
}

export default Index;
