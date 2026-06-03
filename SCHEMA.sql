-- ============================================================
-- SweetTracking — Full Supabase Schema (multi-tenant)
-- Run this entire file in the SQL Editor for a FRESH project.
-- (An existing project should instead apply the MIGRATION_*.sql
--  files in order.)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users). org_id added after organizations.
-- ============================================================
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'employee' check (role in ('employee', 'admin')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table public.organizations (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  notify_vacation boolean not null default true,  -- email admins on new requests
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

alter table public.profiles
  add column org_id uuid references public.organizations(id) on delete set null;

-- ============================================================
-- INVITATIONS (shareable-link based)
-- ============================================================
create table public.invitations (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      text,
  role       text not null default 'employee' check (role in ('employee', 'admin')),
  token      text not null unique,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- TIME_PUNCHES
-- ============================================================
create table public.time_punches (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  punch_in   timestamptz not null,
  punch_out  timestamptz,
  notes      text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- VACATION_REQUESTS
-- ============================================================
create table public.vacation_requests (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  leave_type         text not null default 'Annual Leave',
  start_date         date not null,
  end_date           date not null,
  reason             text,
  availability       text,
  available_window   text,
  contact_method     text,
  emergency_contact  text,
  coverage_tasks     text,
  backup_person      text,
  informed_backup    boolean not null default false,
  critical_deadlines text,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  manager_comments   text,
  reviewed_by        uuid references public.profiles(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- FUNCTIONS (all SECURITY DEFINER — bypass RLS, avoid recursion)
-- ============================================================

-- Auto-create a profile when a user signs up (no org yet — onboarding decides)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), 'employee');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Is the caller an admin?
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- The caller's organization id
create or replace function public.current_org()
returns uuid language sql security definer set search_path = public stable as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- Create an organization; caller becomes its first admin
create or replace function public.create_organization(p_name text)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare v_org public.organizations;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Organization name is required'; end if;
  insert into public.organizations (name, created_by) values (trim(p_name), auth.uid()) returning * into v_org;
  update public.profiles set org_id = v_org.id, role = 'admin' where id = auth.uid();
  return v_org;
end;
$$;

-- Look up an invitation by token (for the join screen)
create or replace function public.get_invitation(p_token text)
returns table (org_name text, role text, status text)
language sql security definer set search_path = public stable as $$
  select o.name, i.role, i.status
  from public.invitations i join public.organizations o on o.id = i.org_id
  where i.token = p_token;
$$;

-- Accept an invitation: join the org with the invited role
create or replace function public.accept_invitation(p_token text)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations; v_org public.organizations;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_inv from public.invitations where token = p_token and status = 'pending';
  if v_inv.id is null then raise exception 'This invitation is invalid or has already been used'; end if;
  update public.profiles set org_id = v_inv.org_id, role = v_inv.role where id = auth.uid();
  update public.invitations set status = 'accepted' where id = v_inv.id;
  select * into v_org from public.organizations where id = v_inv.org_id;
  return v_org;
end;
$$;

-- Admin-only vacation review (employees must not change their own status)
create or replace function public.review_vacation(p_id uuid, p_status text, p_comments text)
returns public.vacation_requests
language plpgsql security definer set search_path = public as $$
declare v_req public.vacation_requests;
begin
  if not public.is_admin() then raise exception 'Only admins can review requests'; end if;
  if p_status not in ('approved', 'denied', 'pending') then raise exception 'Invalid status'; end if;
  update public.vacation_requests vr
     set status = p_status, manager_comments = p_comments,
         reviewed_by = auth.uid(), reviewed_at = now()
   where vr.id = p_id
     and exists (select 1 from public.profiles p where p.id = vr.user_id and p.org_id = public.current_org())
  returning * into v_req;
  if v_req.id is null then raise exception 'Request not found in your organization'; end if;
  return v_req;
end;
$$;

grant execute on function
  public.current_org(), public.create_organization(text),
  public.get_invitation(text), public.accept_invitation(text),
  public.review_vacation(uuid, text, text)
to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY (org-scoped)
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.organizations     enable row level security;
alter table public.invitations       enable row level security;
alter table public.time_punches      enable row level security;
alter table public.vacation_requests enable row level security;

-- Profiles: self always; admins see everyone in their org
create policy "profiles_select_self" on public.profiles for select using (id = auth.uid());
create policy "profiles_select_org"  on public.profiles for select using (public.is_admin() and org_id = public.current_org());
create policy "profiles_insert_self" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid());

-- Organizations: members read theirs; admins rename theirs (creation via RPC)
create policy "org_select_member" on public.organizations for select using (id = public.current_org());
create policy "org_update_admin"  on public.organizations for update using (id = public.current_org() and public.is_admin());

-- Invitations: admins of the owning org manage them (accept via RPC)
create policy "inv_select_admin" on public.invitations for select using (org_id = public.current_org() and public.is_admin());
create policy "inv_insert_admin" on public.invitations for insert with check (org_id = public.current_org() and public.is_admin() and invited_by = auth.uid());
create policy "inv_update_admin" on public.invitations for update using (org_id = public.current_org() and public.is_admin());
create policy "inv_delete_admin" on public.invitations for delete using (org_id = public.current_org() and public.is_admin());

-- Time punches: own always; admins see punches of users in their org
create policy "punches_select_own"   on public.time_punches for select using (auth.uid() = user_id);
create policy "punches_select_admin" on public.time_punches for select using (
  public.is_admin() and exists (
    select 1 from public.profiles p where p.id = time_punches.user_id and p.org_id = public.current_org()
  )
);
create policy "punches_insert_own"   on public.time_punches for insert with check (auth.uid() = user_id);
create policy "punches_update_own"   on public.time_punches for update using (auth.uid() = user_id);
create policy "punches_delete_own"   on public.time_punches for delete using (auth.uid() = user_id);

-- Vacation requests: own always; admins see/update requests of users in their org
create policy "vacation_select_own"   on public.vacation_requests for select using (auth.uid() = user_id);
create policy "vacation_select_admin" on public.vacation_requests for select using (
  public.is_admin() and exists (
    select 1 from public.profiles p where p.id = vacation_requests.user_id and p.org_id = public.current_org()
  )
);
create policy "vacation_insert_own"   on public.vacation_requests for insert with check (auth.uid() = user_id);
create policy "vacation_update_own"   on public.vacation_requests for update using (auth.uid() = user_id);
create policy "vacation_update_admin" on public.vacation_requests for update using (
  public.is_admin() and exists (
    select 1 from public.profiles p where p.id = vacation_requests.user_id and p.org_id = public.current_org()
  )
);

grant select, insert, update, delete on public.organizations, public.invitations to authenticated;

-- Restrict profile UPDATEs to full_name only, and INSERTs to id/email/
-- full_name. role/org_id can change exclusively through the SECURITY
-- DEFINER functions above — a user cannot make themselves an admin or
-- jump into another org.
revoke update on public.profiles from authenticated;
grant  update (full_name) on public.profiles to authenticated;
revoke insert on public.profiles from authenticated;
grant  insert (id, email, full_name) on public.profiles to authenticated;

-- Vacation status changes only via review_vacation() (admin-only RPC).
-- Employees can create requests but cannot approve their own.
revoke update on public.vacation_requests from authenticated;
