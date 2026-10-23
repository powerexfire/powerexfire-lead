import { Copy, Download, ExternalLink, Pencil, RefreshCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isSafeExternalUrl } from "@/lib/lead-pipeline";
import type { Lead, LeadStatus } from "./types";

type LeadsTableProps = {
  leads: Lead[];
  totalLeads: number;
  isLoading: boolean;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSyncLeads: () => void;
  onExport: () => void;
  onCopy: (value: string, label: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onEditLead: (lead: Lead) => void;
};

const display = (value?: string) => {
  const clean = value?.trim();
  if (!clean || clean.toLowerCase() === "none" || clean.toLowerCase() === "null") return "—";
  return clean;
};

export function LeadsTable({ leads, totalLeads, isLoading, searchTerm, onSearchTermChange, onSyncLeads, onExport, onCopy, statusFilter, onStatusFilterChange, onEditLead }: LeadsTableProps) {
  return (
    <section id="leads" className="rounded-xl border border-border bg-card shadow-industrial">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Leads Table</p>
          <h2 className="mt-2 text-2xl font-black text-card-foreground">Saved prospects</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_160px_auto_auto]">
          <label className="sr-only" htmlFor="lead-search">Filter leads</label>
          <input
            id="lead-search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Filter name, phone, email..."
            className="h-10 rounded-lg border border-input bg-background px-4 text-sm font-semibold text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger aria-label="Filter leads by pipeline status"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["new", "contacted", "qualified", "won", "lost"] as LeadStatus[]).map((status) => (
                <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="steel" onClick={onExport} disabled={totalLeads === 0}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
          <Button type="button" variant="steel" onClick={onSyncLeads} disabled={isLoading}>
            <RefreshCcw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Sync leads
          </Button>
        </div>
      </div>

      {isLoading && totalLeads === 0 ? (
        <div className="grid gap-3 p-5 sm:p-6" aria-label="Loading leads">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <SearchX className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-black text-foreground">{totalLeads ? "No matching leads" : "No leads loaded"}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
              {totalLeads ? "Adjust the filter to reveal saved prospects." : "Generate leads or sync the connected leads sheet to display live records here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-collapse text-left">
            <caption className="sr-only">Powerex Fire saved business leads</caption>
            <thead className="bg-muted/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                {['Name', 'Industry', 'Location', 'Status', 'Follow-up', 'Notes', 'Phone', 'Email', 'Website', 'Maps', 'Edit'].map((header) => (
                  <th key={header} scope="col" className="px-5 py-4 font-black">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-accent/45">
                  <th scope="row" className="px-5 py-4 font-black text-foreground">{display(lead.name)}</th>
                  <td className="px-5 py-4 font-semibold text-muted-foreground">{display(lead.industry)}</td>
                  <td className="max-w-[260px] px-5 py-4 font-semibold text-muted-foreground">{display(lead.location || lead.address)}</td>
                  <td className="px-5 py-4"><LeadStatusBadge status={lead.status ?? "new"} /></td>
                  <td className="px-5 py-4 font-semibold text-muted-foreground">{lead.followUpDate ? new Date(`${lead.followUpDate}T00:00:00`).toLocaleDateString() : "—"}</td>
                  <td className="max-w-[220px] truncate px-5 py-4 text-sm text-muted-foreground" title={lead.notes || undefined}>{display(lead.notes)}</td>
                  <td className="px-5 py-4">
                    <Copyable value={display(lead.phone)} label="phone" onCopy={onCopy} />
                  </td>
                  <td className="px-5 py-4">
                    <Copyable value={display(lead.email)} label="email" onCopy={onCopy} />
                  </td>
                  <td className="px-5 py-4">
                    {display(lead.website) !== "—" && isSafeExternalUrl(lead.website) ? (
                      <a className="font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={lead.website} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {isSafeExternalUrl(lead.mapsLink) ? (
                      <Button asChild variant="table" size="sm">
                        <a href={lead.mapsLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Open in Maps
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Button type="button" variant="table" size="iconSm" aria-label={`Edit follow-up for ${lead.name}`} onClick={() => onEditLead(lead)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const variant = status === "won" ? "default" : status === "lost" ? "destructive" : status === "qualified" ? "secondary" : "outline";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${
    variant === "default" ? "border-transparent bg-success text-success-foreground" :
      variant === "destructive" ? "border-transparent bg-destructive text-destructive-foreground" :
        variant === "secondary" ? "border-transparent bg-accent text-accent-foreground" : "border-border bg-muted text-muted-foreground"
  }`}>{status}</span>;
}

function Copyable({ value, label, onCopy }: { value?: string; label: string; onCopy: (value: string, label: string) => void }) {
  if (!value || value === "—") return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-foreground">{value}</span>
      <Button type="button" variant="table" size="iconSm" aria-label={`Copy ${label}`} onClick={() => onCopy(value, label)}>
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
