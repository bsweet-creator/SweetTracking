-- ============================================================
-- Migration 09 — Owner role & member management
-- Run once in the Supabase SQL Editor.
--
-- Adds an 'owner' tier above admin. The org creator is the owner.
-- Owners can change member roles, revoke access, and transfer
-- ownership (which demotes themselves to admin). Owners inherit all
-- admin powers (is_admin() returns true for owners).
-- ============================================================

-- 1. Allow the new role value
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('employee', 'admin', 'owner'));

-- 2. Existing organization creators become owners
update public.profiles p
set role = 'owner'
from public.organizations o
where o.created_by = p.id and p.org_id = o.id;

-- 3. New orgs: creator becomes owner
create or replace function public.create_organization(p_name text)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare v_org public.organizations;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Organization name is required'; end if;
  insert into public.organizations (name, created_by) values (trim(p_name), auth.uid()) returning * into v_org;
  update public.profiles set org_id = v_org.id, role = 'owner' where id = auth.uid();
  return v_org;
end;
$$;

-- 4. Owners count as admins everywhere; add an owner check
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner'));
$$;

create or replace function public.is_owner()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- 5. Owner-only member management (SECURITY DEFINER bypasses column grants)

-- Revoke a member's access (removes them from the org; data is retained)
create or replace function public.remove_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Only the owner can remove members'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  update public.profiles set org_id = null, role = 'employee'
   where id = p_user_id and org_id = public.current_org() and role <> 'owner';
  if not found then raise exception 'Member not found in your organization'; end if;
end;
$$;

-- Change a member's role between employee and admin
create or replace function public.set_member_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Only the owner can change roles'; end if;
  if p_role not in ('employee', 'admin') then raise exception 'Invalid role'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role = p_role
   where id = p_user_id and org_id = public.current_org() and role <> 'owner';
  if not found then raise exception 'Member not found in your organization'; end if;
end;
$$;

-- Transfer ownership to another member; the current owner becomes an admin
create or replace function public.transfer_ownership(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner can transfer ownership'; end if;
  if p_user_id = auth.uid() then raise exception 'You are already the owner'; end if;
  v_org := public.current_org();
  if not exists (select 1 from public.profiles where id = p_user_id and org_id = v_org) then
    raise exception 'Member not found in your organization';
  end if;
  update public.profiles set role = 'owner' where id = p_user_id;
  update public.profiles set role = 'admin' where id = auth.uid();
end;
$$;

grant execute on function
  public.is_owner(),
  public.remove_member(uuid),
  public.set_member_role(uuid, text),
  public.transfer_ownership(uuid)
to authenticated;
