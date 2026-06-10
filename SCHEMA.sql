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
  role       text not null default 'employee' check (role in ('employee', 'admin', 'owner')),
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
-- ACTIVITY CATEGORIES & TIME SEGMENTS (how on-the-clock time is spent)
-- ============================================================
create table public.activity_categories (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.time_segments (
  id          uuid primary key default uuid_generate_v4(),
  punch_id    uuid not null references public.time_punches(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.activity_categories(id) on delete set null,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index time_segments_punch_idx on public.time_segments(punch_id);
create index time_segments_user_idx  on public.time_segments(user_id);

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

-- Is the caller an admin? (owners count as admins everywhere)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner'));
$$;

create or replace function public.is_owner()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- Owner-only member management (SECURITY DEFINER bypasses column grants)
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

create or replace function public.transfer_ownership(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner can transfer ownership'; end if;
  if p_user_id = auth.uid() then raise exception 'You are already the owner'; end if;
  v_org := public.current_org();
  if not exists (select 1 from public.profiles where id = p_user_id and org_id = v_org and role = 'admin') then
    raise exception 'Ownership can only be transferred to an admin';
  end if;
  update public.profiles set role = 'owner' where id = p_user_id;
  update public.profiles set role = 'admin' where id = auth.uid();
end;
$$;

grant execute on function
  public.is_owner(), public.remove_member(uuid), public.transfer_ownership(uuid)
to authenticated;

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
  update public.profiles set org_id = v_org.id, role = 'owner' where id = auth.uid();
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

-- Lookup used by the vacation-notification Edge Function (runs as owner)
create or replace function public.vacation_notify_targets(p_user_id uuid)
returns table (org_name text, notify boolean, requester_name text, admin_emails text[])
language sql security definer set search_path = public stable as $$
  select o.name, o.notify_vacation,
         coalesce(nullif(rp.full_name, ''), rp.email),
         (select array_agg(a.email) from public.profiles a
           where a.org_id = rp.org_id and a.role = 'admin' and a.email is not null)
  from public.profiles rp
  join public.organizations o on o.id = rp.org_id
  where rp.id = p_user_id;
$$;
grant execute on function public.vacation_notify_targets(uuid) to anon, authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY (org-scoped)
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.organizations       enable row level security;
alter table public.invitations         enable row level security;
alter table public.time_punches        enable row level security;
alter table public.vacation_requests   enable row level security;
alter table public.activity_categories enable row level security;
alter table public.time_segments       enable row level security;

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

-- Activity categories: org members read; admins manage
create policy "cat_select_org"   on public.activity_categories for select using (org_id = public.current_org());
create policy "cat_insert_admin" on public.activity_categories for insert with check (org_id = public.current_org() and public.is_admin());
create policy "cat_update_admin" on public.activity_categories for update using (org_id = public.current_org() and public.is_admin());
create policy "cat_delete_admin" on public.activity_categories for delete using (org_id = public.current_org() and public.is_admin());

-- Time segments: own always; admins see segments of users in their org
create policy "seg_select_own"   on public.time_segments for select using (auth.uid() = user_id);
create policy "seg_select_admin" on public.time_segments for select using (
  public.is_admin() and exists (
    select 1 from public.profiles p where p.id = time_segments.user_id and p.org_id = public.current_org()
  )
);
create policy "seg_insert_own"   on public.time_segments for insert with check (auth.uid() = user_id);
create policy "seg_update_own"   on public.time_segments for update using (auth.uid() = user_id);
create policy "seg_delete_own"   on public.time_segments for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.organizations, public.invitations to authenticated;
grant select, insert, update, delete on public.activity_categories, public.time_segments to authenticated;

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

-- ============================================================
-- Function EXECUTE hardening (revoke PUBLIC default; grant per role)
-- ============================================================
revoke execute on function public.handle_new_user() from public;

revoke execute on function public.current_org() from public;
revoke execute on function public.is_admin()    from public;
revoke execute on function public.is_owner()    from public;
grant  execute on function public.current_org(), public.is_admin(), public.is_owner() to authenticated;

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

-- Signup page looks up invites before login → anon needed here
revoke execute on function public.get_invitation(text) from public;
grant  execute on function public.get_invitation(text) to anon, authenticated;

-- Edge-function only (returns admin emails)
revoke execute on function public.vacation_notify_targets(uuid) from public, anon, authenticated;
grant  execute on function public.vacation_notify_targets(uuid) to service_role;
