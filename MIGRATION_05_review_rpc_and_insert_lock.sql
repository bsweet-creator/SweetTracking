-- ============================================================
-- Migration 05 — Authorization hardening
-- Run once in the Supabase SQL Editor.
--
-- Fix 1: Employees could UPDATE their own vacation_requests row,
--        including the `status` column — i.e. approve their own
--        time off. We remove direct UPDATE from clients and route
--        admin reviews through a SECURITY DEFINER RPC that checks
--        is_admin() and same-org membership.
--
-- Fix 2: profiles INSERT allowed arbitrary role/org_id values.
--        Restrict the insertable columns so role/org default safely
--        (role defaults to 'employee', org_id to NULL). Role/org can
--        then only change via create_organization / accept_invitation.
-- ============================================================

-- ---- Fix 1: admin-only vacation review RPC ----
create or replace function public.review_vacation(p_id uuid, p_status text, p_comments text)
returns public.vacation_requests
language plpgsql security definer set search_path = public as $$
declare v_req public.vacation_requests;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review requests';
  end if;
  if p_status not in ('approved', 'denied', 'pending') then
    raise exception 'Invalid status';
  end if;

  update public.vacation_requests vr
     set status = p_status,
         manager_comments = p_comments,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where vr.id = p_id
     and exists (
       select 1 from public.profiles p
       where p.id = vr.user_id and p.org_id = public.current_org()
     )
  returning * into v_req;

  if v_req.id is null then
    raise exception 'Request not found in your organization';
  end if;
  return v_req;
end;
$$;

grant execute on function public.review_vacation(uuid, text, text) to authenticated;

-- Remove direct UPDATE on vacation_requests from clients. Employees
-- still INSERT their own requests; admins review via the RPC above.
revoke update on public.vacation_requests from authenticated;

-- ---- Fix 2: lock down profile inserts ----
revoke insert on public.profiles from authenticated;
grant  insert (id, email, full_name) on public.profiles to authenticated;
