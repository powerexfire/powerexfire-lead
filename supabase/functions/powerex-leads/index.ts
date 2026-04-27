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
const RATE_LIMIT_MAX = 16;
const rateBuckets = new Map<string, number[]>();
const sheetTitleCache = new Map<number, string>();

const CleanString = z.string().trim().min(1).max(120).regex(/^[\p{L}\p{N}\s,.'/&()_-]+$/u, "Only letters, numbers and common location characters are allowed");
const EmailString = z.string().trim().toLowerCase().email().max(255);
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), industry: CleanString.max(80), location: CleanString.max(120) }),
  z.object({ action: z.literal("syncQueries") }),
  z.object({ action: z.literal("syncLeads") }),
  z.object({ action: z.literal("saveLeads"), leads: z.array(z.record(z.unknown())).max(100) }),
  z.object({ action: z.literal("getUsers") }),
  z.object({ action: z.literal("setUserRole"), email: EmailString, role: z.enum(["admin", "user"]) }),
]);

type Action = z.infer<typeof RequestSchema>["action"];
type AppRole = "admin" | "user";
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

type AuthContext = {
  user: { id: string; email?: string };
  token: string;
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
    await ensureAppUser(auth);

    const payload = RequestSchema.safeParse(await safeJson(req));
    if (!payload.success) return json({ success: false, error: "Invalid request. Check industry, location, and lead data." }, 400);

    action = payload.data.action;
    if ("industry" in payload.data) industry = payload.data.industry;
    if ("location" in payload.data) location = payload.data.location;

    if (payload.data.action === "getUsers") {
      return json({ success: true, ...(await getUserManagement(userId)) });
    }

    if (payload.data.action === "setUserRole") {
      const result = await setUserRole(userId, payload.data.email, payload.data.role);
      await recordActivity(auth.token, userId, "setUserRole", "", "", 1, "success", `${payload.data.email} set to ${payload.data.role}.`);
      return json({ success: true, ...result });
    }

    if (payload.data.action === "syncQueries") {
      const queries = await readQueries();
      await recordActivity(auth.token, userId, "syncQueries", "", "", queries.length, "success", "Search queries synced from Query tab.");
      return json({ success: true, queries });
    }

    if (payload.data.action === "syncLeads") {
      const leads = await readLeads();
      await recordActivity(auth.token, userId, "syncLeads", "", "", leads.length, "success", "Saved leads synced from Data tab.");
      return json({ success: true, leads });
    }

    if (payload.data.action === "saveLeads") {
      const normalized = dedupeLeads(normalizeLeads(payload.data.leads, "", ""));
      const savedCount = await appendNewLeads(normalized);
      await recordActivity(auth.token, userId, "saveLeads", "", "", savedCount, "success", `${savedCount} new lead${savedCount === 1 ? "" : "s"} saved to Google Sheets.`);
      return json({ success: true, leads: normalized, savedCount });
    }

    const webhookPayload = {
      industry: payload.data.industry,
      industries: payload.data.industry,
      location: payload.data.location,
      searchLocation: payload.data.location,
      source: "Powerex Fire Lead Dashboard",
      requestedAt: new Date().toISOString(),
    };
    const parsedWebhook = await postWebhook(webhookPayload);
    let leads = dedupeLeads(normalizeLeads(extractLeadRecords(parsedWebhook), payload.data.industry, payload.data.location));
    let savedCount = 0;

    if (leads.length > 0) {
      savedCount = await appendNewLeads(leads);
    } else {
      leads = await pollLeads(payload.data.industry, payload.data.location);
    }

    await recordActivity(auth.token, userId, "generate", payload.data.industry, payload.data.location, leads.length, "success", leads.length ? `Workflow completed with ${leads.length} matching lead${leads.length === 1 ? "" : "s"}.` : "Workflow started, but no matching leads were available yet. Sync leads again shortly.");
    return json({ success: true, leads, savedCount, webhook: parsedWebhook });
  } catch (error) {
    console.error("powerex-leads error", error);
    const message = userSafeError(error);
    if (userId && action) await recordActivityFromEnv(req, userId, action, industry, location, 0, "error", message);
    return json({ success: false, error: message }, error instanceof ResponseError ? error.status : 500);
  }
});

async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new ResponseError("Authentication is required. Please sign in again.", 401);

  const url = requiredEnv("SUPABASE_URL", "Lovable Cloud URL is not configured");
  const anonKey = requiredEnv("SUPABASE_PUBLISHABLE_KEY", "Lovable Cloud authentication key is not configured", "SUPABASE_ANON_KEY");

  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ResponseError("Your session expired. Please sign in again.", 401);
  return { user: { id: data.user.id, email: data.user.email }, token };
}

function serviceClient() {
  const url = requiredEnv("SUPABASE_URL", "Lovable Cloud URL is not configured");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY", "Lovable Cloud admin service is not configured");
  return createClient(url, serviceKey);
}

async function ensureAppUser(auth: AuthContext) {
  const email = clean(auth.user.email ?? "").toLowerCase();
  if (!email) return;
  const client = serviceClient();
  const { error: userError } = await client.from("app_users").upsert({ user_id: auth.user.id, email, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (userError) throw new Error(`User profile sync failed: ${userError.message}`);

  const defaultRole: AppRole = email === "sky_nitu@rediffmail.com" ? "admin" : "user";
  const { data: existing, error: roleReadError } = await client.from("user_roles").select("role").eq("user_id", auth.user.id);
  if (roleReadError) throw new Error(`Role lookup failed: ${roleReadError.message}`);
  if (!existing?.length || defaultRole === "admin") {
    const { error: roleError } = await client.from("user_roles").upsert({ user_id: auth.user.id, role: defaultRole }, { onConflict: "user_id" });
    if (roleError) throw new Error(`Role sync failed: ${roleError.message}`);
  }
}

function requiredEnv(primaryName: string, errorMessage: string, fallbackName?: string) {
  const primaryValue = Deno.env.get(primaryName);
  if (primaryValue) return primaryValue;
  if (fallbackName) {
    const fallbackValue = Deno.env.get(fallbackName);
    if (fallbackValue) return fallbackValue;
  }
  throw new Error(errorMessage);
}

async function isAdmin(userId: string) {
  const client = serviceClient();
  const { data, error } = await client.from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(`Admin check failed: ${error.message}`);
  return Boolean(data);
}

async function requireAdmin(userId: string) {
  if (!(await isAdmin(userId))) throw new ResponseError("Admin access is required for user management.", 403);
}

async function getUserManagement(currentUserId: string) {
  const client = serviceClient();
  const currentRole: AppRole = (await isAdmin(currentUserId)) ? "admin" : "user";
  const usersQuery = currentRole === "admin"
    ? client.from("app_users").select("user_id,email,created_at,updated_at").order("email", { ascending: true })
    : client.from("app_users").select("user_id,email,created_at,updated_at").eq("user_id", currentUserId);
  const { data: users, error: usersError } = await usersQuery;
  if (usersError) throw new Error(`User list failed: ${usersError.message}`);

  const userIds = (users ?? []).map((user) => user.user_id);
  const { data: roles, error: rolesError } = userIds.length
    ? await client.from("user_roles").select("user_id,role").in("user_id", userIds)
    : { data: [], error: null };
  if (rolesError) throw new Error(`Role list failed: ${rolesError.message}`);

  const roleByUser = new Map<string, AppRole>();
  for (const role of roles ?? []) {
    if (role.role === "admin") roleByUser.set(role.user_id, "admin");
    else if (!roleByUser.has(role.user_id)) roleByUser.set(role.user_id, "user");
  }

  return {
    currentRole,
    users: (users ?? []).map((user) => ({
      userId: user.user_id,
      email: user.email,
      role: roleByUser.get(user.user_id) ?? "user",
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })),
  };
}

async function setUserRole(actorUserId: string, email: string, role: AppRole) {
  await requireAdmin(actorUserId);
  const client = serviceClient();
  const cleanEmail = email.trim().toLowerCase();
  const { data: target, error: targetError } = await client.from("app_users").select("user_id,email").eq("email", cleanEmail).maybeSingle();
  if (targetError) throw new Error(`User lookup failed: ${targetError.message}`);
  if (!target) throw new ResponseError("That user has not signed in yet. Ask them to log in once, then assign the role.", 404);

  if (role === "user") {
    const { count, error: countError } = await client.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (countError) throw new Error(`Admin count failed: ${countError.message}`);
    const targetIsAdmin = await isAdmin(target.user_id);
    if (targetIsAdmin && (count ?? 0) <= 1) throw new ResponseError("At least one admin must remain assigned.", 400);
  }

  const deleteRole: AppRole = role === "admin" ? "user" : "admin";
  const { error: deleteError } = await client.from("user_roles").delete().eq("user_id", target.user_id).eq("role", deleteRole);
  if (deleteError) throw new Error(`Role update failed: ${deleteError.message}`);
  const { error: upsertError } = await client.from("user_roles").upsert({ user_id: target.user_id, role }, { onConflict: "user_id" });
  if (upsertError) throw new Error(`Role update failed: ${upsertError.message}`);
  return getUserManagement(actorUserId);
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
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`Lead workflow failed [${response.status}]: ${responseText.slice(0, 300)}`);
  return parseJson(responseText) ?? { message: responseText || "Workflow accepted" };
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
  if (!response.ok) throw new Error(`Google Sheets request failed [${response.status}]: ${typeof data === "string" ? data : JSON.stringify(data).slice(0, 500)}`);
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
    industry: normalizeIndustry(clean(getField(record, headers, ["industry", "industries", "searchindustries", "business type", "sector"]))),
    location: clean(getField(record, headers, ["location", "searchlocation", "city", "area"])),
    query: clean(getField(record, headers, ["query", "search query", "keyword"]) || [getField(record, headers, ["industry", "industries", "searchindustries"]), getField(record, headers, ["location", "searchlocation", "city", "area"])].filter(Boolean).join(" in ") || Object.values(record).join(" ")),
    status: clean(getField(record, headers, ["status"])),
    id: clean(getField(record, headers, ["searchid", "id"])) || `query-${index}`,
  })).filter((query) => query.query || query.industry || query.location);
}

async function readLeads() {
  const rows = await readSheetRows(LEADS_GID);
  const { headers, records } = rowsToRecords(rows);
  return dedupeLeads(records.map((record, index) => normalizeLead(record, index, getField(record, headers, ["industry", "industries", "searchindustries"]), getField(record, headers, ["location", "searchlocation", "city", "area"]))));
}

async function appendNewLeads(leads: Lead[]) {
  if (leads.length === 0) return 0;
  const existing = await readLeads().catch(() => [] as Lead[]);
  const existingKeys = new Set(existing.map(leadKey));
  const fresh = dedupeLeads(leads).filter((lead) => !existingKeys.has(leadKey(lead)));
  if (fresh.length === 0) return 0;
  const title = await sheetTitleByGid(LEADS_GID);
  const range = `${quoteSheet(title)}!A:O`;
  await gateway(`/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ majorDimension: "ROWS", values: fresh.map((lead) => [stableCid(lead), new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), lead.industry, lead.location, lead.name, "", lead.address ?? "", lead.phone ?? "", lead.website ?? "", lead.email ?? "", "", "", "", "", "FALSE"]) }),
  });
  return fresh.length;
}

async function pollLeads(industry: string, location: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) await delay(2_500);
    const leads = await readLeads();
    const matching = filterMatchingLeads(leads, industry, location);
    if (matching.length > 0) return matching.slice(0, 100);
  }
  return [];
}

function filterMatchingLeads(leads: Lead[], industry: string, location: string) {
  const industryTokens = industryAliases(industry);
  const targetLocation = slug(location);
  return leads.filter((lead) => {
    const leadIndustry = slug(lead.industry);
    const leadLocation = slug([lead.location, lead.address].filter(Boolean).join(" "));
    const industryMatches = industryTokens.some((token) => leadIndustry.includes(token) || token.includes(leadIndustry));
    const locationMatches = targetLocation ? leadLocation.includes(targetLocation) : true;
    return industryMatches && locationMatches;
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
  const location = pick(normalized, ["location", "searchlocation", "city", "area"]) || clean(fallbackLocation) || address;
  const website = withProtocol(pick(normalized, ["website", "url", "site"]));
  const phone = normalizePhone(pick(normalized, ["phone", "phone_number", "telephone", "mobile"]));
  return {
    id: stableLeadId(name, phone, website, index),
    name,
    industry: normalizeIndustry(pick(normalized, ["industry", "industries", "searchindustries", "categoryname", "sector", "business_type"]) || clean(fallbackIndustry)),
    location,
    address,
    phone,
    email: normalizeEmail(pick(normalized, ["email", "emails", "email_address"])),
    website,
    mapsLink: safeUrl(pick(normalized, ["google_maps_link", "maps_link", "map", "google_map"])) || mapsSearchLink(name, address),
  };
}

function extractLeadRecords(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.filter(isRecord);
  if (!isRecord(input)) return [];
  for (const key of ["leads", "data", "results", "businesses", "items", "records"]) {
    const value = input[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return input["message"] ? [] : [input];
}

async function recordActivity(token: string, userId: string, action: Action, industry: string, location: string, count: number, status: "success" | "error", message: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
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
    const key = leadKey(lead);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function leadKey(lead: Lead) {
  return [slug(lead.name), normalizePhone(lead.phone ?? ""), slug(lead.website ?? "")].filter(Boolean).join("|");
}

function getField(record: Record<string, string>, headers: string[], candidates: string[]) {
  const slugs = candidates.map(slug);
  for (const candidate of slugs) if (record[candidate]) return record[candidate];
  const found = headers.find((header) => slugs.some((candidate) => header.includes(candidate)));
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

function normalizeIndustry(value: string) {
  const cleaned = clean(value);
  const normalized = slug(cleaned);
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
    housing_society: "Housing Societies",
    schools: "Schools",
    school: "Schools",
    colleges: "Colleges",
    college: "Colleges",
    restaurants: "Restaurants",
    restaurant: "Restaurants",
    clinics: "Clinics",
    clinic: "Clinics",
  };
  return labels[normalized] ?? cleaned;
}

function industryAliases(value: string) {
  const normalized = slug(normalizeIndustry(value));
  const aliases: Record<string, string[]> = {
    factory: ["factory", "factories", "manufacturer", "manufacturing"],
    warehouse: ["warehouse", "warehouses", "storage", "logistics"],
    hospital: ["hospital", "hospitals", "healthcare"],
    hotel: ["hotel", "hotels", "lodging"],
    commercial_building: ["commercial_building", "commercial", "office"],
    housing_societies: ["housing_societies", "housing_society", "society", "residential"],
    schools: ["schools", "school"],
    colleges: ["colleges", "college"],
    restaurants: ["restaurants", "restaurant", "food"],
    clinics: ["clinics", "clinic", "healthcare"],
  };
  return aliases[normalized] ?? [normalized];
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

function stableCid(lead: Lead) {
  const source = leadKey(lead) || crypto.randomUUID();
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) hash = Math.imul(31, hash) + source.charCodeAt(index) | 0;
  return String(Math.abs(hash));
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userSafeError(error: unknown) {
  if (error instanceof ResponseError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "The request timed out. Please retry.";
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("google sheets") || message.includes("gateway") || message.includes("spreadsheet") || message.includes("sheet")) {
      return "Google Sheets sync failed. Confirm the connected account can access the Query and Data tabs, then retry.";
    }
    if (message.includes("workflow") || message.includes("webhook") || message.includes("n8n")) {
      return "Lead workflow failed. Confirm the n8n webhook is active, then retry or sync saved leads.";
    }
    if (message.includes("role") || message.includes("admin") || message.includes("user")) return error.message;
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
