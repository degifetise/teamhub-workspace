# TeamHub (React + Vite + Tailwind CSS v4)

TeamHub is a plain React/JSX workspace app using Supabase, Lucide, Chart.js and jsPDF. With no Supabase keys, it runs in an isolated seeded demo mode. With keys configured, authentication is required and app data comes from the signed-in user's workspace.

## Run locally

1. Install Node.js 18+.
2. Run `npm install`.
3. Run `npm run dev`, then open the Vite URL.

## Configure Supabase

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The root `.env` is ignored by Git; do not commit it.
2. In Supabase, enable **Authentication → Providers → Email → Confirm email** to validate email addresses and advisor linking.
3. Apply migrations in order from `supabase/migrations/`: `001_ppms_workspace_schema.sql`, then `002_teamhub_auth_rbac.sql`.
4. Ensure the private `workspace-documents` and `voice-notes` buckets exist; the first migration creates them. The follow-up migration adds authenticated workspace-scoped storage policies and realtime publication entries.
5. Restart the Vite dev server after changing environment keys.

Registration supplies name, email, password, academic year, department and semester. The database trigger creates the profile; the client does not submit a role. A workspace owner can link an advisor using the advisor's name and email. That advisor receives access only to the matching workspace after signing in with that confirmed email.

The follow-up migration enforces workspace membership roles in RLS: members can create/edit tasks and submit their own pending weekly logs; team leads and owners can delete tasks and manage members/join codes; only the owner can edit or delete the workspace; only a linked advisor can approve or request changes to a pending log.
