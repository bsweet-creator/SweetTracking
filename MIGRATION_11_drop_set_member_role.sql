-- ============================================================
-- Migration 11 — Drop the now-unused set_member_role function
-- Run once in the Supabase SQL Editor.
--
-- Member roles are fixed at invite time (no employee<->admin toggle),
-- so this function has no callers. Ownership transfer is handled by
-- transfer_ownership().
-- ============================================================

drop function if exists public.set_member_role(uuid, text);
