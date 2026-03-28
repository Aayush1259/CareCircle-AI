# CareCircle AI Deployment Guide

## The short version

Yes, you can deploy this project publicly without buying a custom domain.

The simplest public setup is:

- Frontend on Netlify using the default `*.netlify.app` URL
- Backend on a Node host such as Render or Railway using its default URL
- Database, auth, and storage on Supabase

## Important architecture note

Netlify is a good fit for the frontend in this repo.

Netlify is not a direct drop-in host for the current Express backend unless you refactor the API into serverless functions. The current project is built as:

- React frontend
- Separate Express backend
- Supabase database/auth/storage

So the practical public deployment model is:

1. Deploy the backend separately
2. Deploy the frontend to Netlify
3. Point the frontend to the backend with `VITE_API_URL`

## Recommended free or low-cost public demo setup

### Frontend

- Netlify
- Default domain example: `carecircle-ai-demo.netlify.app`

### Backend

- Render or Railway, depending what is available on your account
- Default domain example: `carecircle-api.onrender.com`

### Database and storage

- Supabase free project for database, auth, and storage

## Before you deploy

## 1. Push the repo to GitHub

Create a GitHub repository and push the current project so Netlify and your backend host can import it.

## 2. Prepare environment variables

Use [../.env.example](../.env.example) as your backend checklist and [../apps/web/.env.example](../apps/web/.env.example) as your frontend checklist.

### Frontend environment variables

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Backend environment variables

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `FRONTEND_URL`
- `BACKEND_URL`
- `SUPABASE_STORAGE_BUCKET`
- `PORT`

## 3. Prepare Supabase

In your Supabase project:

1. Create a new project
2. Follow the full click-by-click setup in [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md)
3. Run the migration set in order:
   - [0001_init.sql](../supabase/migrations/0001_init.sql)
   - [0002_identity_access.sql](../supabase/migrations/0002_identity_access.sql)
   - [0003_clinical_audit.sql](../supabase/migrations/0003_clinical_audit.sql)
   - [0004_rls_identity_access.sql](../supabase/migrations/0004_rls_identity_access.sql)
   - [storage.sql](../supabase/storage.sql)
   - [seed.sql](../supabase/seed.sql) if you want demo data

## Deploy the backend first

The frontend cannot work publicly without the backend URL.

## Option A: Render-style setup

Use the repo root as the project source so the shared package still builds.

### Suggested backend build/start configuration

- Build command: `npm install && npm run build:api`
- Start command: `npm --workspace @carecircle/api run start`

### Backend root

- Use the repository root, not only `apps/api`, because the API depends on `packages/shared`

### Backend environment variables

Set every backend variable from the list above.

### Important URL values

Before frontend deployment:

- `BACKEND_URL=https://your-backend-host`
- `FRONTEND_URL=https://temporary-placeholder.example`

After frontend deployment:

- update `FRONTEND_URL` to your real Netlify URL

## Option B: Railway-style setup

The same build logic applies:

- Install dependencies from the monorepo root
- Build from the monorepo root
- Start the API workspace output

### Suggested commands

- Build: `npm install && npm run build:api`
- Start: `npm --workspace @carecircle/api run start`

## Deploy the frontend on Netlify

## Netlify settings

This repo now includes [../netlify.toml](../netlify.toml), so you can use the repo root and let Netlify read the config.

### Netlify config summary

- Build command: `npm run build:web`
- Publish directory: `apps/web/dist`
- SPA redirect rule included for React Router

## Frontend environment variables on Netlify

- `VITE_API_URL=https://your-backend-host/api`
- `VITE_SUPABASE_URL=https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY=your-anon-key`

### Example

```env
VITE_API_URL=https://carecircle-api.onrender.com/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## No custom domain required

You do not need to buy a domain for people to see your work.

Your public URLs can be:

- Frontend: `https://your-project-name.netlify.app`
- Backend: `https://your-backend-name.onrender.com`

Those are enough for:

- judges
- recruiters
- classmates
- mentors
- portfolio visitors

## Demo-safe public deployment checklist

1. Backend live and reachable
2. Frontend live and pointing to backend
3. `FRONTEND_URL` on backend matches the deployed frontend URL
4. Supabase schema and storage configured
5. Demo seed data loaded if you want Ellie Martinez to appear
6. Demo login works
7. File uploads work
8. PDF exports work
9. Emergency share links work
10. Browser refresh on nested routes works

## Post-deploy smoke test

After deployment, test these flows:

1. Open `/login`
2. Sign in with `demo@carecircle.ai / Demo1234!`
3. Open Dashboard and confirm demo data loads
4. Mark a medication as taken
5. Add a journal entry
6. Open Documents and upload a file
7. Open Appointments and create or edit an appointment
8. Open Family Hub and send a message
9. Open Emergency and download the patient card PDF
10. Open Settings and test a preference save
11. Open Documents, upload a file, and confirm it opens through the backend instead of a public storage link

## If you want frontend-only deployment

This current project is not frontend-only.

If you deploy only the React app to Netlify without the backend:

- login will fail
- saves will fail
- uploads will fail
- AI features will fail

That is why the backend must be deployed too.

## Production-readiness warning

Public deployment is possible now for demo or beta use.

That does not mean it is fully healthcare-production-ready.

Use this positioning:

- Good: public demo, portfolio project, hackathon project, pilot for limited testers
- Not yet: broad public healthcare product with full compliance and operations hardening

## Suggested presentation language

If you publish it now, describe it as:

> CareCircle AI is a deployable beta and portfolio-ready caregiving platform built to demonstrate calm, accessible, AI-assisted care coordination.

That is accurate and strong.

## What still needs to happen before calling it "final production"

- security hardening
- monitoring and alerts
- compliance review
- stronger auth/account recovery flows
- rate limiting and abuse protection
- complete end-to-end live persistence/realtime coverage
- broader device and browser QA
