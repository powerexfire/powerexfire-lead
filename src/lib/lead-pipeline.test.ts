import { describe, expect, it } from "vitest";
import { dedupeLeads, isLeadStatus, isSafeExternalUrl, makeLeadDedupeKey, statusLabel } from "./lead-pipeline";
import type { Lead, LeadStatus } from "@/components/powerex/types";

const sampleLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: "source-1",
  name: "North Star School",
  industry: "Schools",
  location: "Pune",
  phone: "+91 98765 43210",
  website: "https://www.northstar.org/contact",
  ...overrides,
});

describe("lead pipeline rules", () => {
  it("normalizes website identity and phone formatting for duplicate detection", () => {
    expect(makeLeadDedupeKey(sampleLead())).toBe(makeLeadDedupeKey(sampleLead({ name: "North Star School Pune", website: "northstar.org/another-page" })));
    expect(makeLeadDedupeKey(sampleLead({ website: undefined }))).toBe(makeLeadDedupeKey(sampleLead({ website: undefined, phone: "919876543210" })));
  });

  it("keeps distinct businesses and drops duplicate records in one result batch", () => {
    const first = sampleLead();
    const duplicate = sampleLead({ id: "source-2", name: "North Star School - Pune", website: "northstar.org" });
    const other = sampleLead({ id: "source-3", phone: "+91 98765 43210", name: "West End School", website: "westend.school" });
    expect(dedupeLeads([first, duplicate, other])).toEqual([first, other]);
  });

  it("defaults unknown pipeline stages to new", () => {
    expect(statusLabel("new")).toBe("new");
    expect(statusLabel(undefined as LeadStatus | undefined)).toBe("new");
  });

  it("accepts only the five pipeline stages", () => {
    expect(["new", "contacted", "qualified", "won", "lost"].every(isLeadStatus)).toBe(true);
    expect(isLeadStatus("pending")).toBe(false);
  });

  it("only allows http and https links to be opened externally", () => {
    expect(isSafeExternalUrl("https://powerexfire.com")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });
});