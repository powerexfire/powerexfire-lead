import { createClient } from "npm:@supabase/supabase-js@2.104.1";
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
const REQUEST_TIMEOUT_MS = 22_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const rateBuckets = new Map<string, number[]>();
const sheetTitleCache = new Map<number, string>();

const CleanString = z.string().trim().min(1).max(120).regex(/^[\p{L}\p{N}\s,.'/&()_-]+$/u, "Only letters, numbers and common location characters are allowed");
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), industry: CleanString.max(80), location: CleanString.max(120) }),
  z.object({ action: z.literal("syncQueries") }),
  z.object({ action: z.literal("syncLeads") }),
  z.object({ action: z.literal("saveLeads"), leads: z.array(z.record(z.unknown())).max(100) }),
]);

type Action = z.infer<typeof RequestSchema>["action"];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  let action: Action | undefined;
  let industry = "";
  let location = "";
  let userId = "";

  try {
    const auth = await authenticate(req);
    userId = auth.user.id;
    enforceRateLimit(userId);

    const payload = RequestSchema.safeParse(await safeJson(req));
    if (!payload.success) return json({ success: false, error: "Invalid request. Check industry, location, and lead data." }, 400);

    action = payload.data.action;
    if ("industry" in payload.data) industry = payload.data.industry;
    if ("location" in payload.data) location = payload.data.location;

    if (payload.data.action === "syncQueries") {
      const queries = await readQueries();
      await recordActivity(auth.token, userId, "syncQueries", "", "", queries.length, "success", "Search queries synced.");
      return json({ success: true, queries });
    }

    if (payload.data.action === "syncLeads") {
      const leads = await readLeads();
      await recordActivity(auth.token, userId, "syncLeads", "", "", leads.length, "success", "Saved leads synced.");
      return json({ success: true, leads });
    }

    if (payload.data.action === "saveLeads") {
      const normalized = dedupeLeads(normalizeLeads(payload.data.leads, "", ""));
      await appendLeads(normalized);
      await recordActivity(auth.token, userId, "saveLeads", "", "", normalized.length, "success", "Leads saved to Google Sheets.");
      return json({ success: true, leads: normalized });
    }

    const webhookPayload = { industry: payload.data.industry, location: payload.data.location, source: "Powerex Fire Lead Dashboard" };
    const parsedWebhook = await postWebhook(webhookPayload);
    const leads = dedupeLeads(normalizeLeads(extractLeadRecords(parsedWebhook), payload.data.industry, payload.data.location));
    if (leads.length > 0) await appendLeads(leads);

    await recordActivity(auth.token, userId, "generate", payload.data.industry, payload.data.location, leads.length, "success", leads.length ? "Leads generated and saved." : "Webhook returned no structured leads.");
    return json({ success: true, leads, webhook: parsedWebhook });
  } catch (error) {
    const message = userSafeError(error);
    if (userId && action) await recordActivityFromEnv(req, userId, action, industry, location, 0, "error", message);
    return json({ success: false, error: message }, error instanceof ResponseError ? error.status : 500);
  }
});

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new ResponseError("Authentication is required.", 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) throw new Error("Cloud authentication is not configured");

  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ResponseError("Your session expired. Please sign in again.", 401);
  return { user: data.user, token };
}

function enforceRateLimit(key: string) {
  const now = Date.now();
  const bucket = (rateBuckets.get(key) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT_MAX) throw new ResponseError("Too many requests. Wait a minute and try again.", 429);
  bucket.push(now);
  rateBuckets.set(key, bucket);
}

async function postWebhook(payload: Record<string, string>) {
  const response = await fetchWithTimeout(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`Lead workflow failed [${response.status}]. Try again or sync saved leads.`);
  return parseJson(responseText) ?? { raw: responseText };
}

async function gateway(path: string, init?: RequestInit) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("Lead storage gateway is not configured");

  const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("Google Sheets connection is not configured");

  const response = await fetchWithTimeout(`${GATEWAY_URL}${path}`, {
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
  if (!response.ok) throw new Error(`Google Sheets request failed [${response.status}]. Verify sheet permissions and try again.`);
  return data;
}

async function fetchWithTimeout(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sheetTitleByGid(gid: number) {
  const cached = sheetTitleCache.get(gid);
  if (cached) return cached;
  const metadata = await gateway(`/spreadsheets/${SPREADSHEET_ID}`) as { sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> };
  const sheet = metadata.sheets?.find((entry) => entry.properties?.sheetId === gid);
  if (!sheet?.properties?.title) throw new Error(`Required sheet tab was not found.`);
  sheetTitleCache.set(gid, sheet.properties.title);
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
    industry: clean(getField(record, headers, ["industry", "industries", "searchindustries", "business type", "sector"])),
    location: clean(getField(record, headers, ["location", "searchlocation", "city", "area"])),
    query: clean(getField(record, headers, ["query", "search query", "keyword"]) || [getField(record, headers, ["industry", "industries", "searchindustries"]), getField(record, headers, ["location", "searchlocation", "city", "area"])].filter(Boolean).join(" in ") || Object.values(record).join(" ")),
    id: `query-${index}`,
  })).filter((query) => query.query || query.industry || query.location);
}

async function readLeads() {
  const rows = await readSheetRows(LEADS_GID);
  const { headers, records } = rowsToRecords(rows);
  return dedupeLeads(records.map((record, index) => normalizeLead(record, index, getField(record, headers, ["industry", "industries", "searchindustries"]), getField(record, headers, ["location", "searchlocation", "city", "area"]))));
}

async function appendLeads(leads: Lead[]) {
  if (leads.length === 0) return;
  const title = await sheetTitleByGid(LEADS_GID);
  const range = `${quoteSheet(title)}!A:H`;
  await gateway(`/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ majorDimension: "ROWS", values: leads.map((lead) => [lead.name, lead.industry, lead.location, lead.address ?? "", lead.phone ?? "", lead.email ?? "", lead.website ?? "", lead.mapsLink ?? ""]) }),
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
  const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [slug(key), clean(String(value ?? ""))]));
  const name = pick(normalized, ["business_name", "title", "name", "company", "company_name", "business"]);
  const address = pick(normalized, ["address", "street_address", "full_address"]);
  const location = pick(normalized, ["location", "city", "area"]) || clean(fallbackLocation) || address;
  const website = withProtocol(pick(normalized, ["website", "url", "site"]));
  return {
    id: stableLeadId(name, pick(normalized, ["phone", "phone_number", "telephone", "mobile"]), website, index),
    name,
    industry: pick(normalized, ["industry", "industries", "searchindustries", "categoryname", "sector", "business_type"]) || clean(fallbackIndustry),
    location,
    address,
    phone: normalizePhone(pick(normalized, ["phone", "phone_number", "telephone", "mobile"])),
    email: normalizeEmail(pick(normalized, ["email", "emails", "email_address"])),
    website,
    mapsLink: safeUrl(pick(normalized, ["google_maps_link", "maps_link", "map", "google_map"])) || mapsSearchLink(name, address),
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

async function recordActivity(token: string, userId: string, action: Action, industry: string, location: string, count: number, status: "success" | "error", message: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) return;
  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  await client.from("lead_activity").insert({ user_id: userId, action, industry: industry || null, location: location || null, result_count: count, status, message: message.slice(0, 500) });
}

async function recordActivityFromEnv(req: Request, userId: string, action: Action, industry: string, location: string, count: number, status: "success" | "error", message: string) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (token) await recordActivity(token, userId, action, industry, location, count, status, message);
}

function dedupeLeads(leads: Lead[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = [lead.name, lead.phone, lead.website].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getField(record: Record<string, string>, headers: string[], candidates: string[]) {
  for (const candidate of candidates.map(slug)) if (record[candidate]) return record[candidate];
  const found = headers.find((header) => candidates.map(slug).some((candidate) => header.includes(candidate)));
  return found ? record[found] : "";
}

function pick(record: Record<string, string>, keys: string[]) {
  for (const key of keys) if (record[key] && !["none", "null", "undefined", "false"].includes(record[key].toLowerCase())) return record[key];
  return "";
}

function quoteSheet(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function clean(value: string) {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function normalizePhone(value: string) {
  return clean(value).replace(/[^+\d\s().-]/g, "").slice(0, 40);
}

function normalizeEmail(value: string) {
  const email = clean(value).split(/[;,\s]+/).find((item) => /^\S+@\S+\.\S+$/.test(item));
  return email ?? "";
}

function mapsSearchLink(name: string, address: string) {
  const query = [name, address].filter(Boolean).join(" ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function withProtocol(value: string) {
  if (!value) return "";
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return safeUrl(candidate);
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function stableLeadId(name: string, phone: string, website: string, index: number) {
  return `${slug(name || phone || website || "lead")}-${index}`;
}

function parseJson(text: string) {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

async function safeJson(req: Request) {
  try { return await req.json(); } catch { throw new ResponseError("Request body must be valid JSON.", 400); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function userSafeError(error: unknown) {
  if (error instanceof ResponseError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "The request timed out. Please retry.";
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("google sheets") || message.includes("gateway") || message.includes("spreadsheet") || message.includes("sheet")) {
      return "Google Sheets sync failed. Confirm the connected account can access both Query and Data tabs, then retry.";
    }
    if (message.includes("workflow") || message.includes("webhook") || message.includes("n8n")) {
      return "Lead workflow failed. Confirm the n8n webhook is active, then retry or sync saved leads.";
    }
    return error.message;
  }
  return "Unknown Powerex lead error";
}

class ResponseError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
