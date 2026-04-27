-- Ensure account rows keep a reliable updated timestamp
DROP TRIGGER IF EXISTS touch_app_users_updated_at ON public.app_users;
CREATE TRIGGER touch_app_users_updated_at
BEFORE UPDATE ON public.app_users
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Prevent duplicate account records for the same email address
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_unique
ON public.app_users (lower(email));

-- Keep role assignment simple and deterministic: one active role per user
DELETE FROM public.user_roles ur
USING public.user_roles keep
WHERE ur.user_id = keep.user_id
  AND ur.id <> keep.id
  AND (
    (keep.role = 'admin'::public.app_role AND ur.role <> 'admin'::public.app_role)
    OR (keep.role = ur.role AND keep.created_at <= ur.created_at)
  );

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user
ON public.user_roles (user_id);

-- Seed the two production Powerex accounts with the intended access levels
INSERT INTO public.user_roles (user_id, role)
SELECT user_id,
       CASE WHEN lower(email) = 'sky_nitu@rediffmail.com'
            THEN 'admin'::public.app_role
            ELSE 'user'::public.app_role
       END
FROM public.app_users
WHERE lower(email) IN ('sky_nitu@rediffmail.com', 'powerexfire2026@gmail.com')
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;