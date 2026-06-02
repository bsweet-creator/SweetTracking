-- ============================================================
-- Migration 04 — Close privilege-escalation hole on profiles
-- Run once in the Supabase SQL Editor.
--
-- Previously an authenticated user could UPDATE their own profile
-- row with no column restriction — including setting role='admin'
-- or changing org_id. We restrict client UPDATEs to full_name only.
-- Role and org_id can then ONLY change via the SECURITY DEFINER
-- functions (create_organization / accept_invitation), which run as
-- the table owner and are unaffected by these column grants.
-- ============================================================

revoke update on public.profiles from authenticated;
grant  update (full_name) on public.profiles to authenticated;
