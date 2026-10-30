DROP POLICY "Authenticated users can delete sales leads" ON public.sales_leads;
REVOKE DELETE ON TABLE public.sales_leads FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.sales_leads TO authenticated;
GRANT UPDATE (status, notes, follow_up_date) ON TABLE public.sales_leads TO authenticated;
GRANT ALL ON TABLE public.sales_leads TO service_role;