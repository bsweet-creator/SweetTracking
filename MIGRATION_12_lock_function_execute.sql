-- ============================================================
-- Migration 12 — Tighten EXECUTE on SECURITY DEFINER functions
-- Run once in the Supabase SQL Editor.
--
-- Postgres grants EXECUTE to PUBLIC by default, so functions were
-- callable by the anon role. We revoke PUBLIC and grant only the role
-- that actually needs each function. RLS helper functions keep
-- `authenticated` (required for row-level security to evaluate).
-- ============================================================

begin;

-- Trigger function — not an API endpoint at all
revoke execute on function public.handle_new_user() from public;

-- RLS helpers — needed by `authenticated` during policy evaluation only
revoke execute on function public.current_org() from public;
revoke execute on function public.is_admin()    from public;
revoke execute on function public.is_owner()    from public;
grant  execute on function public.current_org(), public.is_admin(), public.is_owner()
  to authenticated;

-- Signed-in-only RPCs — drop anon/public, keep authenticated
revoke execute on function public.create_organization(text)        from public;
revoke execute on function public.accept_invitation(text)          from public;
revoke execute on function public.review_vacation(uuid, text, text) from public;
revoke execute on function public.remove_member(uuid)              from public;
revoke execute on function public.transfer_ownership(uuid)         from public;
grant  execute on function
  public.create_organization(text), public.accept_invitation(text),
  public.review_vacation(uuid, text, text), public.remove_member(uuid),
  public.transfer_ownership(uuid)
to authenticated;

-- get_invitation is used on the signup page BEFORE login → keep anon
revoke execute on function public.get_invitation(text) from public;
grant  execute on function public.get_invitation(text) to anon, authenticated;

-- Notification helper returns admin emails → only the edge function (service_role)
revoke execute on function public.vacation_notify_targets(uuid) from public, anon, authenticated;
grant  execute on function public.vacation_notify_targets(uuid) to service_role;

commit;
