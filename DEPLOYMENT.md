# SweetTracking — Deployment & Operations

Employee time-tracking + vacation request app.
**Stack:** React (Vite 6) · Tailwind CSS · Supabase (DB + Auth) · Cloudflare Workers (hosting)

- **Live app:** https://sweettracking.bsweetpersonal.workers.dev/
- **Repo:** https://github.com/bsweet-creator/SweetTracking
- **Hosting:** Cloudflare Workers (auto-deploys from GitHub `main`)
- **Backend:** Supabase project `vpuurhhlhptsbtgeiwsa`

---

## Deploying changes

Cloudflare auto-builds and deploys on every push to `main`:

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/School/SP2026/App1/timetracker
git add -A
git commit -m "describe the change"
git push
```

Test locally first with `npm run dev` → http://localhost:5173

---

## Environment variables

Local lives in `.env` (gitignored). The live site uses the same two vars,
set in **Cloudflare → Workers & Pages → sweettracking → Settings → Variables**:

```
VITE_SUPABASE_URL=https://vpuurhhlhptsbtgeiwsa.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

If you add a new env var, set it in BOTH `.env` and the Cloudflare dashboard.

---

## Supabase auth configuration

Under **Authentication → URL Configuration**:
- **Site URL:** `https://sweettracking.bsweetpersonal.workers.dev`
- **Redirect URLs:** `https://sweettracking.bsweetpersonal.workers.dev/**`

---

## Onboarding & roles (multi-tenant)

The app is multi-org. After signing up, a user lands on an **onboarding** screen and either:
- **Creates an organization** (becomes that org's admin), or
- **Joins via an invite link** (`https://app/?invite=TOKEN`) with the role the inviter chose.

Admins invite people from the **Team** tab (generates a shareable link). Data is fully
isolated per organization via row-level security keyed on `org_id` + the `current_org()`
and `is_admin()` SECURITY DEFINER functions.

Manually move a user to a different org / role (rarely needed) in the SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'person@company.com';
```

Database schema lives in `SCHEMA.sql` (authoritative for fresh projects);
incremental changes in `MIGRATION_*.sql` (apply in order to an existing project).

---

## Known notes
- **Free Supabase projects auto-pause after ~7 days of zero activity.** Daily team
  use keeps it awake; if it pauses, un-pause from the Supabase dashboard (~1 min, no data loss).
- Invite links are unguessable tokens and single-use (marked `accepted` once used).
  Admins can revoke pending invites from the Team tab.
