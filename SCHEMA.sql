-- ============================================================
-- Time Tracker - Supabase SQL Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES table (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'employee' check (role in ('employee', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TIME_PUNCHES table
-- ============================================================
create table public.time_punches (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  punch_in    timestamptz not null,
  punch_out   timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- VACATION_REQUESTS table
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
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.time_punches      enable row level security;
alter table public.vacation_requests enable row level security;

-- SECURITY DEFINER helper to check admin role WITHOUT recursive RLS.
-- Referencing public.profiles directly inside a profiles policy causes
-- "infinite recursion detected in policy" (500 errors). This function
-- bypasses RLS, so it is safe to call from any policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles: users see/insert/update their own; admins see all
create policy "profiles_select_own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles for select using (public.is_admin());
create policy "profiles_insert_own"   on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"   on public.profiles for update using (auth.uid() = id);

-- Time punches: employees manage their own; admins read all
create policy "punches_select_own"   on public.time_punches for select using (auth.uid() = user_id);
create policy "punches_select_admin" on public.time_punches for select using (public.is_admin());
create policy "punches_insert_own"   on public.time_punches for insert with check (auth.uid() = user_id);
create policy "punches_update_own"   on public.time_punches for update using (auth.uid() = user_id);
create policy "punches_delete_own"   on public.time_punches for delete using (auth.uid() = user_id);

-- Vacation requests: employees manage their own; admins read + update all
create policy "vacation_select_own"   on public.vacation_requests for select using (auth.uid() = user_id);
create policy "vacation_select_admin" on public.vacation_requests for select using (public.is_admin());
create policy "vacation_insert_own"   on public.vacation_requests for insert with check (auth.uid() = user_id);
create policy "vacation_update_own"   on public.vacation_requests for update using (auth.uid() = user_id);
create policy "vacation_update_admin" on public.vacation_requests for update using (public.is_admin());
