# SweetTracking — Deployment & Operations

Employee time-tracking + vacation request app.
**Stack:** React (Vite 6) · Tailwind CSS · Supabase (DB + Auth) · Cloudflare Workers (hosting)

- **Live app:** https://track.sweetbuilds.com  (also https://sweettracking.bsweetpersonal.workers.dev/)
- **Repo:** https://github.com/bsweet-creator/SweetTracking
- **Hosting:** Cloudflare Workers (auto-deploys from GitHub `main`); custom domain
  `track.sweetbuilds.com` added under Worker → Settings → Domains & Routes
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
- **Site URL:** `https://track.sweetbuilds.com`
- **Redirect URLs:** `https://track.sweetbuilds.com/**` (and the `.workers.dev/**` URL)

Email confirmation is currently **disabled** (Authentication → Providers → Email),
so signups are immediate. Re-enable once real email (SMTP) is configured.

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
incremental changes in `MIGRATION_*.sql` (apply in order to an existing project):
- `MIGRATION_01` — expanded vacation request fields
- `MIGRATION_02` — allow employees to delete their own punches
- `MIGRATION_03` — organizations + invitations (multi-tenant); wipes test data
- `MIGRATION_04` — lock profile UPDATE to full_name (no self-promote to admin)
- `MIGRATION_05` — admin-only `review_vacation()` RPC + lock profile INSERT columns

---

## Security posture (internal-use)
- **RLS on every table**, org-scoped via `current_org()` + `is_admin()` (SECURITY DEFINER).
- Role/org changes only through `create_organization` / `accept_invitation`; vacation
  approvals only through `review_vacation`. Clients have no direct UPDATE on those columns.
- No secrets in the repo (only `.env.example`); client uses the public publishable key.
- HTTPS via Cloudflare; `npm audit` clean.
- **Known hardening TODO before selling externally:** email verification, stronger password
  policy / MFA, invite-link expiry, audit trail on punch edits.

## Known notes
- **Free Supabase projects auto-pause after ~7 days of zero activity.** Daily team
  use keeps it awake; if it pauses, un-pause from the Supabase dashboard (~1 min, no data loss).
- Invite links are unguessable tokens and single-use (marked `accepted` once used).
  Admins can revoke pending invites from the Team tab.
- To show someone your org's data, send them an **invite link** (Team tab), not the bare
  URL — the bare URL drops new signups into their own empty organization.
