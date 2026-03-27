# Supabase Setup Guide

This is the step-by-step Supabase setup for the current CareCircle AI repo.

It matches the real architecture:

- frontend in `apps/web`
- backend in `apps/api`
- shared types in `packages/shared`
- Supabase used for Postgres, Auth, and Storage

It does **not** assume a frontend-only app.

## What Supabase handles here

Use Supabase for:

- PostgreSQL database
- Auth
- private document storage

Keep these on the backend only:

- OpenAI
- SMTP or Resend
- Supabase service-role access

## What you need before starting

- Your Supabase project already created
- Your Render backend already deployed
- Your Netlify frontend already deployed
- Your backend env vars ready:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`
  - `SUPABASE_STORAGE_BUCKET`

## Step 1: Copy the API values from Supabase

Open:

`Supabase Dashboard -> Project Settings -> API`

Copy these values:

- `Project URL`
- `anon / publishable key`
- `service_role / secret key`

Use them like this:

- Netlify:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Render:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`

## Step 2: Configure Auth URLs

Open:

`Supabase Dashboard -> Authentication -> URL Configuration`

Set:

- `Site URL` = your Netlify frontend URL

Add these redirect URLs:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`
- `http://localhost:5173/invite/*`
- `https://your-netlify-site.netlify.app/auth/callback`
- `https://your-netlify-site.netlify.app/reset-password`
- `https://your-netlify-site.netlify.app/invite/*`

If your final route differs slightly, match the actual frontend routes in the repo.

## Step 3: Enable email auth

Open:

`Supabase Dashboard -> Authentication -> Providers -> Email`

Make sure:

- Email provider is enabled
- Email confirmations are enabled if you want verified-account gating

## Step 4: Run the SQL in this order

Open:

`Supabase Dashboard -> SQL Editor`

Run these files one by one, in this exact order:

1. [supabase/migrations/0001_init.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/migrations/0001_init.sql)
2. [supabase/migrations/0002_identity_access.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/migrations/0002_identity_access.sql)
3. [supabase/migrations/0003_clinical_audit.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/migrations/0003_clinical_audit.sql)
4. [supabase/migrations/0004_rls_identity_access.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/migrations/0004_rls_identity_access.sql)
5. [supabase/storage.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/storage.sql)
6. [supabase/seed.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/seed.sql) if you want demo content

### What the new migrations add

- `0002_identity_access.sql`
  - doctor-capable user role support
  - `patient_access`
  - invite tokens and granular permissions
  - patient ownership fields and permission helpers

- `0003_clinical_audit.sql`
  - `audit_log`
  - `clinical_notes`
  - `weekly_summaries`
  - document visibility metadata

- `0004_rls_identity_access.sql`
  - helper functions for patient ownership and access checks
  - row-level policies for identity, documents, clinical notes, summaries, and audit visibility

## Step 5: Confirm the tables exist

Open:

`Supabase Dashboard -> Table Editor`

Confirm you now see at least:

- `users`
- `patients`
- `patient_access`
- `medications`
- `medication_logs`
- `care_journal`
- `documents`
- `appointments`
- `health_vitals`
- `tasks`
- `clinical_notes`
- `audit_log`
- `weekly_summaries`

## Step 6: Confirm private storage

Open:

`Supabase Dashboard -> Storage`

Confirm bucket exists:

- `carecircle-documents`

The bucket should stay private.

Important:

- CareCircle should access documents through backend-generated signed URLs
- Do not convert patient document buckets to public

## Step 7: Redeploy the backend

After the SQL and storage setup is done, redeploy Render so the backend starts using the completed schema and storage config.

Then test:

- `https://your-render-app.onrender.com/api/health`

Expected shape:

```json
{
  "ok": true,
  "status": "ok",
  "db": "connected"
}
```

If `db` is `demo`, your Supabase env vars are still missing on the backend.

If `db` is `error`, check:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- whether the SQL was applied successfully

## Step 8: Redeploy the frontend

After backend is healthy, redeploy Netlify so the frontend uses the live API and the current document-access flow.

Netlify frontend env vars should include:

- `VITE_API_URL=https://your-render-app.onrender.com/api`
- `VITE_SUPABASE_URL=https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY=your-anon-key`

## Step 9: Test the auth and sharing basics

Run these in order:

1. Sign in with `demo@carecircle.ai / Demo1234`
2. Open the dashboard
3. Open Documents and upload a file
4. Open the uploaded file from the document modal
5. Confirm it opens through a backend-generated access URL
6. Invite a family member from the Family area
7. Accept the invite with the invited account

## Do you need any other services?

For the core setup, no.

Supabase Free is enough for:

- database
- auth
- private storage

Optional extras only:

- SMTP or Resend for transactional email
- OpenAI for live AI features
- SMS provider later
- push notification provider later

## Most important rule

If the browser can read a key, it is not a secret.

That means:

- `anon` key is fine in Netlify
- `service_role` key must stay on Render only
- OpenAI and email provider secrets must stay on Render only
