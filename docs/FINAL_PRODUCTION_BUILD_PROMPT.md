# CareCircle AI Final Production Build Prompt

## Authoritative version for this repo

This is the adapted and authoritative version of the final build prompt for the current CareCircle AI codebase.

It intentionally matches the real repository structure:

- `apps/web`
- `apps/api`
- `packages/shared`
- `supabase/`

It also preserves the secure secret model already established in the repo:

- frontend-safe values only in `apps/web/.env.local`
- backend and server-only secrets in root `.env`
- no browser-side OpenAI or Resend secret exposure

## Core build instruction

Build and maintain CareCircle AI as a deployment-ready, full-stack caregiving application using the current monorepo architecture. All credentials must come from environment variables, and no secret key may be hardcoded in source code, docs, or tracked config files.

## Credentials setup for this repo

### Frontend-safe environment variables

Use these in `apps/web/.env.local` and in Netlify:

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Server-only environment variables

Use these in root `.env` locally and on the backend host:

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

### Security rule

Use:

- `import.meta.env.VITE_SUPABASE_URL`
- `import.meta.env.VITE_SUPABASE_ANON_KEY`
- `import.meta.env.VITE_API_URL`

Do **not** use:

- `VITE_OPENAI_API_KEY`
- `VITE_RESEND_API_KEY`

OpenAI and email sending must remain on the backend API or secure server-side functions.

## Repository structure

```text
carecircle-ai/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   ├── .env.example
│   │   └── .env.local        ← local only, gitignored
│   └── api/
│       └── src/
├── packages/
│   └── shared/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── storage.sql
├── docs/
├── .env                     ← local only, gitignored
├── .env.example
├── .gitignore
├── netlify.toml
└── README.md
```

## Required product areas

The product should continue to support the existing major areas already established in the project:

- Authentication and login gate
- Role-aware app shell and navigation
- Dashboard
- Medications
- Care Journal
- Documents
- Appointments
- Health Vitals
- Family Hub
- Tasks
- Emergency
- Floating Care Chat
- Settings

## Frontend architecture requirements

Keep the frontend in `apps/web` using the current React + Vite setup.

### Required frontend behaviors

- Mobile-first responsive UI
- Sidebar on desktop, mobile bottom navigation on small screens
- Floating Care Chat button available globally
- Form validation with clear feedback
- Accessible labels and focus states
- API calls routed through the backend API base

## Backend architecture requirements

Keep the backend in `apps/api` using the current Express server.

### Required backend responsibilities

- Auth/session handling
- Feature CRUD endpoints
- AI orchestration
- PDF/export generation
- Email sending
- document processing
- secure environment-variable access

## Supabase requirements

Use the current repo layout for Supabase setup:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_identity_access.sql`
- `supabase/migrations/0003_clinical_audit.sql`
- `supabase/migrations/0004_rls_identity_access.sql`
- `supabase/storage.sql`
- `supabase/seed.sql`

For the actual click-by-click dashboard setup, use:

- [docs/SUPABASE_SETUP_GUIDE.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/SUPABASE_SETUP_GUIDE.md)

Do not replace the repo with a conflicting `frontend/`-only structure.

## Role-aware app expectations

### Primary caregiver

- Full app access
- Default route: `/app/dashboard`

### Family member

- Restricted write access depending on permissions
- Family-focused workflows

### Doctor or healthcare provider

- Read-focused clinical interface
- No family-only data exposure beyond approved scope

## Feature expectations

### Medications

- Adherence overview
- Time-block medication schedule
- Taken/missed logging
- Interaction checks
- Refill tracking

### Care Journal

- Entry modal
- Mood, pain, severity, tags, follow-up
- AI title generation
- AI entry analysis
- 30-day pattern analysis

### Documents

- Upload flow
- PDF/image processing
- AI summary
- action items
- doctor questions

### Appointments

- Calendar
- upcoming/past views
- prep notes
- question suggestions
- follow-up notes

### Health Vitals

- Overview cards
- trend charts
- analysis
- normal range reference

### Family Hub

- family members
- invites
- feed
- chat
- coordination board

### Emergency

- quick action bar
- patient info
- protocol cards
- PDF
- QR/share

### Settings

- profile
- patient profile
- notifications
- display
- help
- feedback
- export/privacy

## Deployment model

Use the current deployment model for this repo:

- Frontend: Netlify
- Backend: Render
- Database/Auth/Storage: Supabase

### Netlify environment variables

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Render environment variables

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

## Pre-deployment verification

- `.env` exists locally and is ignored
- `apps/web/.env.local` exists locally and is ignored
- `.env.example` and `apps/web/.env.example` contain placeholders only
- `Api s.txt` and `Supabase.txt` are ignored and never committed
- frontend build passes
- backend build passes
- tests pass
- Netlify points to the backend API
- Supabase auth URLs are set correctly
- demo accounts exist before final seed/live verification

## Final positioning

This project is suitable for:

- public demo
- portfolio showcase
- judge review
- limited beta use

It should not be described as a fully hardened healthcare production platform until security, compliance, monitoring, and broader operational hardening are completed.
