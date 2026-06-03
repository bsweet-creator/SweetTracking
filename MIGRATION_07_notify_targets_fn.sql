-- ============================================================
-- Migration 07 — Helper for the vacation-notification Edge Function
-- Run once in the Supabase SQL Editor.
--
-- The Edge Function couldn't read profiles/organizations directly
-- (the injected key resolved to a role without table access). This
-- SECURITY DEFINER function does all the lookups as the table owner
-- and returns exactly what the email needs, so the function can call
-- it regardless of which role its key maps to.
-- ============================================================

create or replace function public.vacation_notify_targets(p_user_id uuid)
returns table (
  org_name       text,
  notify         boolean,
  requester_name text,
  admin_emails   text[]
)
language sql security definer set search_path = public stable as $$
  select
    o.name,
    o.notify_vacation,
    coalesce(nullif(rp.full_name, ''), rp.email),
    (
      select array_agg(a.email)
      from public.profiles a
      where a.org_id = rp.org_id and a.role = 'admin' and a.email is not null
    )
  from public.profiles rp
  join public.organizations o on o.id = rp.org_id
  where rp.id = p_user_id;
$$;

grant execute on function public.vacation_notify_targets(uuid)
  to anon, authenticated, service_role;
