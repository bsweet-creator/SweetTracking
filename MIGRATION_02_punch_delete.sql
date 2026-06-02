-- ============================================================
-- Migration 02 — Allow employees to delete their own time punches
-- Needed for the "edit / manual time entry" feature so mistaken
-- entries can be removed. Run once in the Supabase SQL Editor.
-- ============================================================

create policy "punches_delete_own"
  on public.time_punches for delete
  using (auth.uid() = user_id);
