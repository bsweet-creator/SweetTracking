-- ============================================================
-- Migration 10 — Ownership can only transfer to an admin
-- Run once in the Supabase SQL Editor.
-- ============================================================

create or replace function public.transfer_ownership(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner can transfer ownership'; end if;
  if p_user_id = auth.uid() then raise exception 'You are already the owner'; end if;
  v_org := public.current_org();
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and org_id = v_org and role = 'admin'
  ) then
    raise exception 'Ownership can only be transferred to an admin';
  end if;
  update public.profiles set role = 'owner' where id = p_user_id;
  update public.profiles set role = 'admin' where id = auth.uid();
end;
$$;
