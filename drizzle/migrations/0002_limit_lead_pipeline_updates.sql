REVOKE UPDATE ON TABLE public.sales_leads FROM authenticated;
GRANT UPDATE (status, notes, follow_up_date) ON TABLE public.sales_leads TO authenticated;
GRANT ALL ON TABLE public.sales_leads TO service_role;