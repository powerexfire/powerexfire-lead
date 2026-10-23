import type { Lead, LeadStatus } from "@/components/powerex/types";

export const leadStatuses: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

function clean(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function makeLeadDedupeKey(lead: Pick<Lead, "name" | "location" | "phone" | "website">) {
  const phone = (lead.phone ?? "").replace(/\D/g, "");
  if (phone.length >= 7) return `phone:${phone}`;

  const name = clean(lead.name);
  const website = clean(lead.website)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/, 1)[0];
  if (website) return `website:${website}|name:${name}`;

  return `name:${name}|location:${clean(lead.location)}`;
}

export function dedupeLeads(leads: Lead[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = makeLeadDedupeKey(lead);
    if (!lead.name.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isSafeExternalUrl(value?: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function statusLabel(status?: LeadStatus) {
  return leadStatuses.find((value) => value === status) ?? "new";
}