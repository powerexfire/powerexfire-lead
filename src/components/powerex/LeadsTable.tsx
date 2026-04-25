import { Copy, ExternalLink, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lead } from "./types";

type LeadsTableProps = {
  leads: Lead[];
  isLoading: boolean;
  onSyncLeads: () => void;
  onCopy: (value: string, label: string) => void;
};

const display = (value?: string) => value?.trim() || "—";

export function LeadsTable({ leads, isLoading, onSyncLeads, onCopy }: LeadsTableProps) {
  return (
    <section id="leads" className="rounded-xl border border-border bg-card shadow-industrial">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Leads Table</p>
          <h2 className="mt-2 text-2xl font-black text-card-foreground">Saved prospects</h2>
        </div>
        <Button type="button" variant="steel" onClick={onSyncLeads} disabled={isLoading}>
          <RefreshCcw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          Sync leads
        </Button>
      </div>

      {leads.length === 0 ? (
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <RefreshCcw className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-black text-foreground">No leads loaded</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
              Generate leads or sync the connected leads sheet to display live records here.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-muted/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                {['Name', 'Industry', 'Location', 'Phone', 'Email', 'Website', 'Maps'].map((header) => (
                  <th key={header} className="px-5 py-4 font-black">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-accent/45">
                  <td className="px-5 py-4 font-black text-foreground">{display(lead.name)}</td>
                  <td className="px-5 py-4 font-semibold text-muted-foreground">{display(lead.industry)}</td>
                  <td className="px-5 py-4 font-semibold text-muted-foreground">{display(lead.location || lead.address)}</td>
                  <td className="px-5 py-4">
                    <Copyable value={lead.phone} label="phone" onCopy={onCopy} />
                  </td>
                  <td className="px-5 py-4">
                    <Copyable value={lead.email} label="email" onCopy={onCopy} />
                  </td>
                  <td className="px-5 py-4">
                    {lead.website ? (
                      <a className="font-bold text-primary underline-offset-4 hover:underline" href={lead.website} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {lead.mapsLink ? (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Copyable({ value, label, onCopy }: { value?: string; label: string; onCopy: (value: string, label: string) => void }) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-foreground">{value}</span>
      <Button type="button" variant="table" size="iconSm" aria-label={`Copy ${label}`} onClick={() => onCopy(value, label)}>
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
