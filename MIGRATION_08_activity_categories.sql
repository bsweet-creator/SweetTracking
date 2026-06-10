-- ============================================================
-- Migration 08 — Activity categories & shift time segments
-- Run once in the Supabase SQL Editor.
--
-- Lets workers tag how they spend on-the-clock time. A clock-in
-- (time_punches row) is split into one or more time_segments, each
-- tagged with an admin-defined activity_category. Real-time: switching
-- activity closes the current segment and opens a new one.
-- ============================================================

-- Admin-defined categories, scoped per organization
create table if not exists public.activity_categories (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Segments that split a punch into category-tagged spans
create table if not exists public.time_segments (
  id          uuid primary key default uuid_generate_v4(),
  punch_id    uuid not null references public.time_punches(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.activity_categories(id) on delete set null,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists time_segments_punch_idx on public.time_segments(punch_id);
create index if not exists time_segments_user_idx  on public.time_segments(user_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.activity_categories enable row level security;
alter table public.time_segments       enable row level security;

-- Categories: everyone in the org can read; only admins manage
create policy "cat_select_org"   on public.activity_categories for select using (org_id = public.current_org());
create policy "cat_insert_admin" on public.activity_categories for insert with check (org_id = public.current_org() and public.is_admin());
create policy "cat_update_admin" on public.activity_categories for update using (org_id = public.current_org() and public.is_admin());
create policy "cat_delete_admin" on public.activity_categories for delete using (org_id = public.current_org() and public.is_admin());

-- Segments: own always; admins see segments of users in their org
create policy "seg_select_own"   on public.time_segments for select using (auth.uid() = user_id);
create policy "seg_select_admin" on public.time_segments for select using (
  public.is_admin() and exists (
    select 1 from public.profiles p where p.id = time_segments.user_id and p.org_id = public.current_org()
  )
);
create policy "seg_insert_own"   on public.time_segments for insert with check (auth.uid() = user_id);
create policy "seg_update_own"   on public.time_segments for update using (auth.uid() = user_id);
create policy "seg_delete_own"   on public.time_segments for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.activity_categories, public.time_segments to authenticated;
