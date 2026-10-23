CREATE TABLE public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  industry text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  address text,
  phone text,
  email text,
  website text,
  maps_link text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost')),
  notes text NOT NULL DEFAULT '',
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_leads_dedupe_key_unique UNIQUE (dedupe_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_leads TO authenticated;
GRANT ALL ON public.sales_leads TO service_role;

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sales leads"
ON public.sales_leads FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create sales leads"
ON public.sales_leads FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sales leads"
ON public.sales_leads FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sales leads"
ON public.sales_leads FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE INDEX sales_leads_created_at_idx ON public.sales_leads (created_at DESC);
CREATE INDEX sales_leads_status_follow_up_idx ON public.sales_leads (status, follow_up_date);

CREATE TRIGGER touch_sales_leads_updated_at
BEFORE UPDATE ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();