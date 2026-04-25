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
  industry: string;
  location: string;
  query: string;
};

export type StatusTone = "idle" | "loading" | "success" | "error";
