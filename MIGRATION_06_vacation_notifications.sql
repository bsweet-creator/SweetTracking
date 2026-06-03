-- ============================================================
-- Migration 06 — Vacation-request email notifications (org toggle)
-- Run once in the Supabase SQL Editor.
--
-- Adds an org-wide on/off switch. The actual email is sent by the
-- `notify-vacation-request` Edge Function, fired by a Database Webhook
-- on INSERT into vacation_requests (see DEPLOYMENT.md for setup).
-- Admins can already UPDATE their own organization row, so no new
-- policy is needed to flip this.
-- ============================================================

alter table public.organizations
  add column if not exists notify_vacation boolean not null default true;
