-- ============================================================
-- Migration 03 — Multi-tenant Organizations & Invitations
-- Converts the app into a multi-org SaaS. Run once in the
-- Supabase SQL Editor. This WIPES existing test data (fresh start).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Organizations
-- ------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Add org_id to profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

-- ------------------------------------------------------------
-- 3. Invitations (shareable-link based)
-- ------------------------------------------------------------
create table if not exists public.invitations (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      text,                       -- optional, for the admin's reference
  role       text not null default 'employee' check (role in ('employee', 'admin')),
  token      text not null unique,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER — bypass RLS, no recursion)
-- ------------------------------------------------------------

-- Caller's organization id
create or replace function public.current_org()
returns uuid language sql security definer set search_path = public stable as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- is_admin() already exists from the base schema; kept as-is.

-- Create an organization and make the caller its first admin
create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql security definer set search_path = public as $$
declare v_org public.organizations;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Organization name is required'; end if;

  insert into public.organizations (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into v_org;

  update public.profiles
     set org_id = v_org.id, role = 'admin'
   where id = auth.uid();

  return v_org;
end;
$$;

-- Look up invitation details by token (for the join screen, before accepting)
create or replace function public.get_invitation(p_token text)
returns table (org_name text, role text, status text)
language sql security definer set search_path = public stable as $$
  select o.name, i.role, i.status
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token;
$$;

-- Accept an invitation: join the org with the invited role
create or replace function public.accept_invitation(p_token text)
returns public.organizations
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invitations;
  v_org public.organizations;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_inv from public.invitations
   where token = p_token and status = 'pending';
  if v_inv.id is null then raise exception 'This invitation is invalid or has already been used'; end if;

  update public.profiles
     set org_id = v_inv.org_id, role = v_inv.role
   where id = auth.uid();

  update public.invitations set status = 'accepted' where id = v_inv.id;

  select * into v_org from public.organizations where id = v_inv.org_id;
  return v_org;
end;
$$;

grant execute on function
  public.current_org(),
  public.create_organization(text),
  public.get_invitation(text),
  public.accept_invitation(text)
to authenticated;

-- ------------------------------------------------------------
-- 5. New-user trigger: default to employee, no org (onboarding decides)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'employee'
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 6. Row Level Security — org-scoped
-- ------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.invitations   enable row level security;

-- Organizations: members can read theirs; admins can rename theirs.
-- (Creation happens through create_organization(), which is SECURITY DEFINER.)
drop policy if exists "org_select_member" on public.organizations;
drop policy if exists "org_update_admin"  on public.organizations;
create policy "org_select_member" on public.organizations
  for select using (id = public.current_org());
create policy "org_update_admin" on public.organizations
  for update using (id = public.current_org() and public.is_admin());

-- Invitations: only admins of the owning org can manage them.
-- (Accepting happens through accept_invitation(), SECURITY DEFINER.)
drop policy if exists "inv_select_admin" on public.invitations;
drop policy if exists "inv_insert_admin" on public.invitations;
drop policy if exists "inv_update_admin" on public.invitations;
drop policy if exists "inv_delete_admin" on public.invitations;
create policy "inv_select_admin" on public.invitations
  for select using (org_id = public.current_org() and public.is_admin());
create policy "inv_insert_admin" on public.invitations
  for insert with check (org_id = public.current_org() and public.is_admin() and invited_by = auth.uid());
create policy "inv_update_admin" on public.invitations
  for update using (org_id = public.current_org() and public.is_admin());
create policy "inv_delete_admin" on public.invitations
  for delete using (org_id = public.current_org() and public.is_admin());

-- Profiles: self always; admins see everyone in their org.
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_select_self"  on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_select_org"   on public.profiles;
drop policy if exists "profiles_insert_own"   on public.profiles;
drop policy if exists "profiles_insert_self"  on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_update_self"  on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_select_org" on public.profiles
  for select using (public.is_admin() and org_id = public.current_org());
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- Time punches: own always; admins see punches of users in their org.
drop policy if exists "punches_select_admin" on public.time_punches;
create policy "punches_select_admin" on public.time_punches
  for select using (
    public.is_admin() and exists (
      select 1 from public.profiles p
      where p.id = time_punches.user_id and p.org_id = public.current_org()
    )
  );

-- Vacation requests: own always; admins see/update requests of users in their org.
drop policy if exists "vacation_select_admin" on public.vacation_requests;
drop policy if exists "vacation_update_admin" on public.vacation_requests;
create policy "vacation_select_admin" on public.vacation_requests
  for select using (
    public.is_admin() and exists (
      select 1 from public.profiles p
      where p.id = vacation_requests.user_id and p.org_id = public.current_org()
    )
  );
create policy "vacation_update_admin" on public.vacation_requests
  for update using (
    public.is_admin() and exists (
      select 1 from public.profiles p
      where p.id = vacation_requests.user_id and p.org_id = public.current_org()
    )
  );

grant select, insert, update, delete on public.organizations, public.invitations to authenticated;

-- ------------------------------------------------------------
-- 7. FRESH START — wipe existing test data
-- Existing auth users keep their login but will re-onboard
-- (create or join an organization) on next sign-in.
-- ------------------------------------------------------------
delete from public.vacation_requests;
delete from public.time_punches;
delete from public.invitations;
delete from public.organizations;
update public.profiles set org_id = null, role = 'employee';
