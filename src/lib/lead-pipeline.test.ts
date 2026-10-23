import { describe, expect, it } from "vitest";
import { dedupeLeads, isSafeExternalUrl, makeLeadDedupeKey, statusLabel } from "./lead-pipeline";
import type { Lead } from "@/components/powerex/types";

const sampleLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: "source-1",
  name: "North Star School",
  industry: "Schools",
  location: "Pune",
  phone: "+91 98765 43210",
  ...overrides,
});

describe("lead pipeline rules", () => {
  it("uses normalized phone numbers to identify the same business", () => {
    expect(makeLeadDedupeKey(sampleLead())).toBe(makeLeadDedupeKey(sampleLead({ phone: "919876543210" })));
  });

  it("keeps distinct businesses and drops duplicate records in one result batch", () => {
    const first = sampleLead();
    const duplicate = sampleLead({ id: "source-2", name: "North Star School - Pune" });
    const other = sampleLead({ id: "source-3", phone: "02012345678", name: "West End School" });
    expect(dedupeLeads([first, duplicate, other])).toEqual([first, other]);
  });

  it("defaults unknown pipeline stages to new", () => {
    expect(statusLabel("new")).toBe("new");
    expect(statusLabel("invalid" as Lead["status"])).toBe("new");
  });

  it("only allows http and https links to be opened externally", () => {
    expect(isSafeExternalUrl("https://powerexfire.com")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });
});