import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, AppUser, Lead, LeadActivity, SearchQuery, StatusTone } from "./types";
import type { LeadStatus } from "./types";
import { dedupeLeads, makeLeadDedupeKey } from "@/lib/lead-pipeline";

const initialStatus = "Ready to generate leads from live sources.";
const locationPattern = /^[a-zA-Z0-9\s,.'-]{2,120}$/;

export type FunctionResponse = {
  success?: boolean;
  leads?: Lead[];
  queries?: SearchQuery[];
  users?: AppUser[];
  currentRole?: AppRole;
  savedCount?: number;
  error?: string;
};

type PersistResult = { savedCount: number; duplicateCount: number };

type WorkspaceValue = {
  session: Session;
  industry: string;
  location: string;
  leads: Lead[];
  queries: SearchQuery[];
  activity: LeadActivity[];
  users: AppUser[];
  currentRole: AppRole;
  statusTone: StatusTone;
  statusMessage: string;
  isLoading: boolean;
  isSavingLead: boolean;
  isUserLoading: boolean;
  searchTerm: string;
  statusFilter: string;
  selectedLead: Lead | null;
  filteredLeads: Lead[];
  activeQuery: SearchQuery | undefined;
  setIndustry: (value: string) => void;
  setLocation: (value: string) => void;
  setSearchTerm: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setSelectedLead: (lead: Lead | null) => void;
  generateLeads: () => Promise<void>;
  syncQueries: () => Promise<void>;
  syncLeads: () => Promise<void>;
  saveLeadDetails: (lead: Lead, changes: { status: LeadStatus; notes: string; followUpDate: string | null }) => Promise<void>;
  assignRole: (email: string, role: AppRole) => Promise<void>;
  applyQuery: (query: SearchQuery) => void;
  loadActivity: () => Promise<void>;
  loadUsers: (silent?: boolean) => Promise<void>;
  copyValue: (value: string, label: string) => Promise<void>;
  exportCsv: () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function usePowerexWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("usePowerexWorkspace must be used inside WorkspaceProvider");
  return value;
}

export function WorkspaceProvider({ session, children }: { session: Session; children: ReactNode }) {
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
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const lastActionRef = useRef<(() => void) | null>(null);
  const requestIdRef = useRef(0);

  const loadActivity = useCallback(async () => {
    const { data, error } = await supabase
      .from("lead_activity")
      .select("id, action, industry, location, result_count, status, message, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) setActivity(data as LeadActivity[]);
  }, []);

  const loadStoredLeads = useCallback(async () => {
    const pageSize = 1000;
    const allRows: Array<{
      id: string;
      name: string;
      industry: string;
      location: string;
      address: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      maps_link: string | null;
      status: string;
      notes: string;
      follow_up_date: string | null;
    }> = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("sales_leads")
        .select("id,name,industry,location,address,phone,email,website,maps_link,status,notes,follow_up_date")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        toast.error(`Saved lead history could not be loaded: ${error.message}`);
        return false;
      }

      allRows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    setLeads(allRows.map((row) => ({
      id: row.id,
      name: row.name,
      industry: row.industry,
      location: row.location,
      address: row.address ?? undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      website: row.website ?? undefined,
      mapsLink: row.maps_link ?? undefined,
      status: normalizeLeadStatus(row.status),
      notes: row.notes,
      followUpDate: row.follow_up_date ?? undefined,
    })));
    return true;
  }, []);

  const persistLeadRecords = useCallback(async (input: Lead[]): Promise<PersistResult> => {
    setIsSavingLead(true);
    try {
      const uniqueLeads = dedupeLeads(input);
      if (!uniqueLeads.length) {
        await loadStoredLeads();
        return { savedCount: 0, duplicateCount: input.length };
      }

      const rows = uniqueLeads.map((lead) => ({
        dedupe_key: makeLeadDedupeKey(lead),
        user_id: session.user.id,
        name: lead.name.trim().slice(0, 255),
        industry: lead.industry.trim().slice(0, 80),
        location: lead.location.trim().slice(0, 120),
        address: lead.address?.trim().slice(0, 500) || null,
        phone: lead.phone?.trim().slice(0, 80) || null,
        email: lead.email?.trim().slice(0, 255) || null,
        website: lead.website?.trim().slice(0, 500) || null,
        maps_link: lead.mapsLink?.trim().slice(0, 1000) || null,
      }));

      const { data, error } = await supabase
        .from("sales_leads")
        .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id");

      if (error) throw new Error(`Lead history could not be saved: ${error.message}`);
      if (!(await loadStoredLeads())) throw new Error("Leads were saved, but the updated history could not be reloaded.");
      const savedCount = data?.length ?? 0;
      return { savedCount, duplicateCount: Math.max(0, input.length - savedCount) };
    } finally {
      setIsSavingLead(false);
    }
  }, [loadStoredLeads, session.user.id]);

  const runAction = useCallback(async (body: Record<string, unknown>, loadingMessage: string, options?: { silent?: boolean }) => {
    const tracksStatus = !options?.silent;
    const requestId = tracksStatus ? ++requestIdRef.current : requestIdRef.current;
    if (tracksStatus) {
      setIsLoading(true);
      setStatusTone("loading");
      setStatusMessage(loadingMessage);
    }

    try {
      const { data, error } = await supabase.functions.invoke<FunctionResponse>("powerex-leads", { body });
      if (tracksStatus && requestId !== requestIdRef.current) return null;

      if (error || data?.success === false) {
        const message = data?.error || error?.message || "Unable to complete the lead request.";
        if (tracksStatus) {
          setStatusTone("error");
          setStatusMessage(message);
        }
        toast.error(message);
        return null;
      }

      return data ?? {};
    } finally {
      if (!tracksStatus || requestId === requestIdRef.current) {
        if (tracksStatus) setIsLoading(false);
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
    void loadStoredLeads();
  }, [loadActivity, loadStoredLeads, loadUsers]);

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

    const liveLeads = dedupeLeads(data.leads ?? []);
    let persistence: PersistResult = { savedCount: 0, duplicateCount: 0 };
    try {
      persistence = await persistLeadRecords(liveLeads);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lead history could not be saved.";
      setStatusTone("error");
      setStatusMessage(message);
      toast.error(message);
      return;
    }
    setStatusTone("success");
    setStatusMessage(liveLeads.length ? `Found ${liveLeads.length} lead${liveLeads.length === 1 ? "" : "s"}; ${persistence.savedCount} added to history${persistence.duplicateCount ? `, ${persistence.duplicateCount} duplicate${persistence.duplicateCount === 1 ? "" : "s"} skipped` : ""}.` : "Workflow started successfully. No matching leads are available yet; use Sync leads again in a moment.");
    toast.success("Lead generation completed and history updated");
  }, [industry, location, persistLeadRecords, runAction]);

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
    const sheetLeads = dedupeLeads(data.leads ?? []);
    let persistence: PersistResult = { savedCount: 0, duplicateCount: 0 };
    try {
      persistence = await persistLeadRecords(sheetLeads);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lead history could not be updated.";
      setStatusTone("error");
      setStatusMessage(message);
      toast.error(message);
      return;
    }
    setStatusTone("success");
    setStatusMessage(`Checked ${sheetLeads.length} sheet lead${sheetLeads.length === 1 ? "" : "s"}; ${persistence.savedCount} new record${persistence.savedCount === 1 ? "" : "s"} added to history${persistence.duplicateCount ? `, ${persistence.duplicateCount} duplicate${persistence.duplicateCount === 1 ? "" : "s"} skipped` : ""}.`);
  }, [persistLeadRecords, runAction]);

  const saveLeadDetails = useCallback(async (lead: Lead, changes: { status: LeadStatus; notes: string; followUpDate: string | null }) => {
    setIsSavingLead(true);
    try {
      const { error } = await supabase.from("sales_leads").update({
        status: changes.status,
        notes: changes.notes,
        follow_up_date: changes.followUpDate,
      }).eq("id", lead.id);

      if (error) throw error;

      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, ...changes } : item));
      setSelectedLead(null);
      setStatusTone("success");
      setStatusMessage(`Follow-up details saved for ${lead.name}.`);
      toast.success("Follow-up details saved");
    } catch (error) {
      const message = `Lead follow-up could not be saved: ${error instanceof Error ? error.message : "Please retry."}`;
      setStatusTone("error");
      setStatusMessage(message);
      toast.error(message);
    } finally {
      setIsSavingLead(false);
    }
  }, []);

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

  const copyValue = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard access was blocked by the browser.");
    }
  }, []);

  const exportCsv = useCallback(() => {
    if (!leads.length) return;
    const headers = ["Name", "Industry", "Location", "Address", "Phone", "Email", "Website", "Google Maps Link", "Status", "Follow-up date", "Notes"];
    const rows = leads.map((lead) => [lead.name, lead.industry, lead.location, lead.address ?? "", lead.phone ?? "", lead.email ?? "", lead.website ?? "", lead.mapsLink ?? "", lead.status ?? "new", lead.followUpDate ?? "", lead.notes ?? ""]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `powerex-fire-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export ready");
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !term || [lead.name, lead.industry, lead.location, lead.phone, lead.email, lead.website, lead.notes].some((value) => value?.toLowerCase().includes(term));
      return matchesSearch && (statusFilter === "all" || (lead.status ?? "new") === statusFilter);
    });
  }, [leads, searchTerm, statusFilter]);

  const activeQuery = useMemo(() => {
    const targetIndustry = slug(industry);
    const targetLocation = slug(location);
    return queries.find((query) => slug(query.industry).includes(targetIndustry) && slug(query.location) === targetLocation);
  }, [industry, location, queries]);

  const value = useMemo<WorkspaceValue>(() => ({
    session,
    industry,
    location,
    leads,
    queries,
    activity,
    users,
    currentRole,
    statusTone,
    statusMessage,
    isLoading,
    isSavingLead,
    isUserLoading,
    searchTerm,
    statusFilter,
    selectedLead,
    filteredLeads,
    activeQuery,
    setIndustry,
    setLocation,
    setSearchTerm,
    setStatusFilter,
    setSelectedLead,
    generateLeads,
    syncQueries,
    syncLeads,
    saveLeadDetails,
    assignRole,
    applyQuery,
    loadActivity,
    loadUsers,
    copyValue,
    exportCsv,
  }), [
    session, industry, location, leads, queries, activity, users, currentRole, statusTone, statusMessage,
    isLoading, isSavingLead, isUserLoading, searchTerm, statusFilter, selectedLead, filteredLeads, activeQuery,
    generateLeads, syncQueries, syncLeads, saveLeadDetails, assignRole, applyQuery, loadActivity, loadUsers, copyValue, exportCsv,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export { locationPattern, slug, normalizeIndustry };

function slug(value = "") {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizeLeadStatus(value?: string): LeadStatus {
  return value === "contacted" || value === "qualified" || value === "won" || value === "lost" ? value : "new";
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
