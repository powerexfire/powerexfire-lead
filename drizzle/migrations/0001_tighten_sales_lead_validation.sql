ALTER TABLE public.sales_leads
ADD CONSTRAINT sales_leads_notes_max_length
CHECK (char_length(notes) <= 2000);

DROP POLICY "Authenticated users can create sales leads" ON public.sales_leads;

CREATE POLICY "Users can create sales leads as themselves"
ON public.sales_leads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);