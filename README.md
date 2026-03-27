# CareCircle AI

CareCircle AI is a calm, compassionate full-stack web application for family caregivers. It turns medication tracking, care journaling, document interpretation, family coordination, emergency planning, and AI support into one simple command center that a non-technical caregiver can understand in seconds.

## Documentation index

- Full project documentation: [docs/PROJECT_DOCUMENTATION.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/PROJECT_DOCUMENTATION.md)
- Prompt history and issue log: [docs/PROMPT_HISTORY_AND_ISSUE_LOG.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/PROMPT_HISTORY_AND_ISSUE_LOG.md)
- Deployment guide: [docs/DEPLOYMENT_GUIDE.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/DEPLOYMENT_GUIDE.md)
- Secrets and GitHub setup: [docs/SECRETS_AND_GITHUB_SETUP.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/SECRETS_AND_GITHUB_SETUP.md)
- Final build prompt for this repo: [docs/FINAL_PRODUCTION_BUILD_PROMPT.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/FINAL_PRODUCTION_BUILD_PROMPT.md)

## The problem

Family caregivers are often managing medications, symptoms, appointments, paperwork, and family updates across text threads, notebooks, and memory. That creates stress, missed details, and avoidable risk.

CareCircle AI solves that by bringing the most important caregiving tasks into one clear, mobile-friendly workflow:

- Daily AI briefing with what matters today
- Medication schedule, adherence tracking, refill reminders, and interaction checks
- Care journal with AI pattern analysis
- Document upload with OCR and plain-English summaries
- Appointments with AI preparation support
- Health vitals logging and AI trend interpretation
- Family coordination board, shared updates, and chat
- One-tap emergency access with personalized protocols
- Warm AI caregiver chat and emotional check-ins

## Target user

- Primary user: a 45-year-old daughter caring for her 78-year-old father
- Secondary users: siblings, home health aides, family helpers
- Design goal: every screen should feel understandable in under 10 seconds

## Screens and features

- Onboarding: 6-step setup flow with optional first medication and family invite
- Dashboard: daily briefing, stats, quick actions, medication timeline, appointments, AI insights, activity feed
- Medications: adherence, weekly chart, today schedule, list, interaction checker, refill tracker
- Care Journal: searchable entries, AI entry analysis, 30-day pattern report
- Documents: drag-and-drop upload, OCR/PDF parsing, AI summary, action items, medical term glossary
- Appointments: month calendar, upcoming list, AI question suggestions, follow-up capture
- Health Vitals: trend cards, charts, normal ranges, AI reading analysis
- Family Hub: members, invite flow, shared activity feed, reactions, coordination board, family chat
- Tasks: today/week/overdue views, AI task suggestions, assignments and recurrence
- Emergency: one-tap help, personalized protocols, QR sharing, printable emergency card
- Care Chat: floating patient-aware AI assistant, saved sessions, suggested prompts, caregiver check-ins
- Settings: profile, notifications, display accessibility, exports, help links, feedback
- Real login gate: demo-safe auth flow with `demo@carecircle.ai / Demo1234`

## Screenshots

Add final screenshots here before submission:

- `docs/screenshots/dashboard.png`
- `docs/screenshots/medications.png`
- `docs/screenshots/journal.png`
- `docs/screenshots/documents.png`
- `docs/screenshots/appointments.png`
- `docs/screenshots/family.png`
- `docs/screenshots/emergency.png`
- `docs/screenshots/care-chat.png`

## Tech stack

- Frontend: React 18, Vite, Tailwind CSS, Framer Motion, React Router v6, Lucide React, React Hot Toast, Chart.js, jsPDF, qrcode.react
- Backend: Node.js, Express, Supabase-ready storage/auth hooks, OpenAI-ready AI service layer, Multer, pdf-parse, Tesseract.js, node-cron, Nodemailer
- Database: Supabase PostgreSQL schema and seed SQL included under `supabase/`
- Deployment targets: Vercel for web, Railway for API, Supabase for database/storage

## Demo account

- Email: `demo@carecircle.ai`
- Password: `Demo1234`

## Current status

- Strong portfolio and judge demo project
- Publicly deployable as a beta/demo
- Not yet a fully hardened healthcare-grade production product

## Local setup

1. Copy `.env.example` to `.env` and fill in the keys you have.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173/login` and sign in with `demo@carecircle.ai / Demo1234`.
5. Optional: apply `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, and `supabase/storage.sql` in your Supabase project.

If OpenAI, SMTP, or Supabase keys are missing, the app still runs in demo-safe fallback mode with seeded data and the same demo login.

## Project structure

```text
apps/
  api/        Express API, AI services, uploads, cron, exports
  web/        React app, routing, UI, charts, modals, responsive shell
packages/
  shared/     Shared types and demo seed builders
supabase/
  migrations/ Database schema
  seed.sql    Demo data
  storage.sql Storage bucket and policies
```

## Deployment

### Netlify frontend + separate backend

- Frontend can be deployed to Netlify using the included [netlify.toml](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/netlify.toml)
- Backend must still be deployed separately because the current architecture uses an Express API
- No custom domain is required; free platform URLs are enough for demos and public review
- Full instructions: [docs/DEPLOYMENT_GUIDE.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/DEPLOYMENT_GUIDE.md)

### Frontend env vars

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Backend env vars

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

## Live demo

- Frontend URL: add your deployed Netlify or Vercel link here
- Backend URL: add your deployed API link here

## Demo video

- Loom: add your published Loom demo link here

## Tests

- Frontend component tests: Vitest + React Testing Library
- API tests: Vitest + Supertest
- Judge-critical browser checks: Playwright

## Future roadmap

- Richer Supabase Auth account recovery and invite acceptance
- Push notifications and SMS reminders
- Richer family permissions and audit logs
- Medical device integrations for automatic vitals import
- Smarter longitudinal AI summarization with clinician-approved guardrails
