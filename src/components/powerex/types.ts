export type Lead = {
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

export type SearchQuery = {
  id?: string;
  industry: string;
  location: string;
  query: string;
};

export type LeadActivity = {
  id: string;
  action: "generate" | "syncQueries" | "syncLeads" | "saveLeads";
  industry: string | null;
  location: string | null;
  result_count: number;
  status: "success" | "error";
  message: string | null;
  created_at: string;
};

export type StatusTone = "idle" | "loading" | "success" | "error";
