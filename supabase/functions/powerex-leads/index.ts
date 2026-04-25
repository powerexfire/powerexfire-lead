import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SPREADSHEET_ID = "1013CNMc4Ydpr5x4TtNAlvbe3iPER0oFU-ysglfLWIYY";
const QUERY_GID = 0;
const LEADS_GID = 1560841529;
const WEBHOOK_URL = "https://redican.app.n8n.cloud/webhook/Powerex-Fire-Lead";

type Lead = {
  id: string;
  name: string;
  industry: string;
  location: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  mapsLink?: string;
};

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), industry: z.string().trim().min(1).max(80), location: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal("syncQueries") }),
  z.object({ action: z.literal("syncLeads") }),
  z.object({ action: z.literal("saveLeads"), leads: z.array(z.record(z.unknown())).max(100) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = RequestSchema.safeParse(await req.json());
    if (!payload.success) {
      return json({ success: false, error: payload.error.flatten().fieldErrors }, 400);
    }

    if (payload.data.action === "syncQueries") {
      const queries = await readQueries();
      return json({ success: true, queries });
    }

    if (payload.data.action === "syncLeads") {
      const leads = await readLeads();
      return json({ success: true, leads });
    }

    if (payload.data.action === "saveLeads") {
      const normalized = normalizeLeads(payload.data.leads, "", "");
      await appendLeads(normalized);
      return json({ success: true, leads: normalized });
    }

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry: payload.data.industry, location: payload.data.location, source: "Powerex Fire Lead Dashboard" }),
    });

    const responseText = await webhookResponse.text();
    if (!webhookResponse.ok) {
      throw new Error(`Powerex webhook failed [${webhookResponse.status}]: ${responseText}`);
    }

    const parsedWebhook = parseJson(responseText);
    const leads = normalizeLeads(extractLeadRecords(parsedWebhook), payload.data.industry, payload.data.location);
    if (leads.length > 0) {
      await appendLeads(leads);
    }

    return json({ success: true, leads, webhook: parsedWebhook ?? responseText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Powerex lead error";
    return json({ success: false, error: message }, 500);
  }
});

async function gateway(path: string, init?: RequestInit) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured for Powerex Sheets access");

  const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured for Powerex Sheets access");

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = parseJson(text) ?? text;
  if (!response.ok) {
    throw new Error(`Google Sheets gateway failed [${response.status}]: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function sheetTitleByGid(gid: number) {
  const metadata = await gateway(`/spreadsheets/${SPREADSHEET_ID}`) as { sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> };
  const sheet = metadata.sheets?.find((entry) => entry.properties?.sheetId === gid);
  if (!sheet?.properties?.title) throw new Error(`Sheet tab with gid ${gid} was not found`);
  return sheet.properties.title;
}

async function readSheetRows(gid: number) {
  const title = await sheetTitleByGid(gid);
  const range = `${quoteSheet(title)}!A1:Z1000`;
  const data = await gateway(`/spreadsheets/${SPREADSHEET_ID}/values/${range}`) as { values?: string[][] };
  return data.values ?? [];
}

async function readQueries() {
  const rows = await readSheetRows(QUERY_GID);
  const { headers, records } = rowsToRecords(rows);
  return records.map((record, index) => ({
    industry: getField(record, headers, ["industry", "industries", "searchindustries", "business type", "sector"]),
    location: getField(record, headers, ["location", "city", "area"]),
    query: getField(record, headers, ["query", "search query", "keyword"]) || [getField(record, headers, ["industry", "industries", "searchindustries"]), getField(record, headers, ["location", "searchlocation", "city", "area"])].filter(Boolean).join(" in ") || Object.values(record).join(" ").trim(),
    id: `query-${index}`,
  })).filter((query) => query.query || query.industry || query.location);
}

async function readLeads() {
  const rows = await readSheetRows(LEADS_GID);
  const { headers, records } = rowsToRecords(rows);
  return records.map((record, index) => normalizeLead(record, index, getField(record, headers, ["industry", "industries", "searchindustries"]), getField(record, headers, ["location", "searchlocation", "city", "area"])));
}

async function appendLeads(leads: Lead[]) {
  if (leads.length === 0) return;
  const title = await sheetTitleByGid(LEADS_GID);
  const range = `${quoteSheet(title)}!A:H`;
  await gateway(`/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({
      majorDimension: "ROWS",
      values: leads.map((lead) => [lead.name, lead.industry, lead.location, lead.address ?? "", lead.phone ?? "", lead.email ?? "", lead.website ?? "", lead.mapsLink ?? ""]),
    }),
  });
}

function rowsToRecords(rows: string[][]) {
  const headers = (rows[0] ?? []).map((value) => slug(value));
  const records = rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header || `column_${index}`, row[index] ?? ""])));
  return { headers, records };
}

function normalizeLeads(records: Record<string, unknown>[], industry: string, location: string) {
  return records.map((record, index) => normalizeLead(record, index, industry, location)).filter((lead) => lead.name || lead.phone || lead.email || lead.website);
}

function normalizeLead(record: Record<string, unknown>, index: number, fallbackIndustry: string, fallbackLocation: string): Lead {
  const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [slug(key), String(value ?? "").trim()]));
  const name = pick(normalized, ["business_name", "title", "name", "company", "company_name", "business"]);
  const address = pick(normalized, ["address", "street_address", "full_address"]);
  const location = pick(normalized, ["location", "city", "area"]) || fallbackLocation || address;
  const website = withProtocol(pick(normalized, ["website", "url", "site"]));
  return {
    id: `${name || "lead"}-${index}-${Date.now()}`,
    name,
    industry: pick(normalized, ["industry", "industries", "searchindustries", "categoryname", "sector", "business_type"]) || fallbackIndustry,
    location,
    address,
    phone: pick(normalized, ["phone", "phone_number", "telephone", "mobile"]),
    email: pick(normalized, ["email", "emails", "email_address"]),
    website,
    mapsLink: pick(normalized, ["google_maps_link", "maps_link", "map", "google_map"]) || mapsSearchLink(name, address),
  };
}

function extractLeadRecords(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.filter(isRecord);
  if (!isRecord(input)) return [];
  for (const key of ["leads", "data", "results", "businesses", "items"]) {
    const value = input[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [input];
}

function getField(record: Record<string, string>, headers: string[], candidates: string[]) {
  for (const candidate of candidates.map(slug)) {
    if (record[candidate]) return record[candidate];
  }
  const found = headers.find((header) => candidates.map(slug).some((candidate) => header.includes(candidate)));
  return found ? record[found] : "";
}

function pick(record: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (record[key]) return record[key];
  }
  return "";
}

function quoteSheet(title: string) {
  return `'${title.replaceAll("'", "''")}'`;
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function mapsSearchLink(name: string, address: string) {
  const query = [name, address].filter(Boolean).join(" ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function withProtocol(value: string) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function parseJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
