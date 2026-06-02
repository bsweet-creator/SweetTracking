-- ============================================================
-- Migration 01 — Expand vacation_requests with detailed fields
-- Run this in the Supabase SQL Editor (safe to run once).
-- All columns are additive, so existing rows keep working.
-- ============================================================

alter table public.vacation_requests
  add column if not exists leave_type         text not null default 'Annual Leave',
  add column if not exists availability        text,
  add column if not exists available_window    text,
  add column if not exists contact_method      text,
  add column if not exists emergency_contact   text,
  add column if not exists coverage_tasks      text,
  add column if not exists backup_person       text,
  add column if not exists informed_backup     boolean not null default false,
  add column if not exists critical_deadlines  text,
  add column if not exists manager_comments    text;
