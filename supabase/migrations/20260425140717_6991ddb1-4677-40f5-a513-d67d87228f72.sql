CREATE TABLE public.lead_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('generate', 'syncQueries', 'syncLeads', 'saveLeads')),
  industry TEXT,
  location TEXT,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lead activity"
ON public.lead_activity
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lead activity"
ON public.lead_activity
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_lead_activity_user_created_at
ON public.lead_activity (user_id, created_at DESC);

CREATE INDEX idx_lead_activity_status
ON public.lead_activity (status);