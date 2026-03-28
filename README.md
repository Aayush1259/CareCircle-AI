# CareCircle AI

CareCircle AI is a caregiver-focused full-stack web app for tracking medications, symptoms, documents, appointments, family coordination, and emergency information in one calm, mobile-friendly workspace.

The project is set up as a TypeScript monorepo with:

- `apps/web`: React + Vite frontend
- `apps/api`: Express API
- `packages/shared`: shared types, permissions, and demo data
- `supabase/`: database migrations, seed data, and storage setup

## Live deployment

- Frontend: [https://carecircle-ai.netlify.app/](https://carecircle-ai.netlify.app/)
- Backend: deployed separately on Render
- Auth, database, and storage: Supabase

## Highlights

- Daily caregiver dashboard with AI briefing and quick actions
- Medication schedule, adherence logging, refill tracking, and interaction checks
- Care journal with AI-assisted analysis
- Document upload with OCR, summaries, and follow-up actions
- Appointments, vitals, family coordination, tasks, and emergency workflows
- Role-aware access for caregivers, family members, and clinicians

## Tech stack

- Frontend: React 18, Vite, Tailwind CSS, Framer Motion, React Router, Chart.js
- Backend: Node.js, Express, TypeScript, Supabase integrations, OpenAI-ready service layer
- Tooling: npm workspaces, Vitest, Playwright, tsup
- Data: Supabase PostgreSQL, storage, and auth

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env`.
3. Set a real `JWT_SECRET` before starting the API.
4. Add the Supabase and frontend/backend environment variables you have available.
5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:5173/login`

Demo login:

- Email: `demo@carecircle.ai`
- Password: `Demo1234!`

If OpenAI, SMTP, or Supabase credentials are missing, the app can still run in demo-safe fallback mode.

## Scripts

At the repo root:

- `npm run dev`: start web and API together
- `npm run build`: build shared, API, and web
- `npm run test`: run API and web unit tests
- `npm run test:e2e`: run Playwright end-to-end checks

## Environment variables

Frontend:

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend:

- `JWT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

For the live frontend deployment, make sure backend `FRONTEND_URL` includes:

- `https://carecircle-ai.netlify.app`

## Project structure

```text
apps/
  api/          Express API, auth/session logic, exports, AI/document services
  web/          React app, routes, pages, shell, and tests
packages/
  shared/       Shared types, permissions, helpers, demo snapshot
scripts/        Repo helpers including the E2E runner
supabase/
  migrations/   Database schema
  seed.sql      Demo seed data
  storage.sql   Storage setup
docs/           Deployment, setup, and project notes
```

## Testing

- Unit/integration: Vitest
- Browser checks: Playwright

Verified locally with:

- `npm run test`
- `npm run build`
- `npm run test:e2e`

## Deployment notes

- The frontend is intended for Netlify and uses [`netlify.toml`](./netlify.toml).
- The API is intended for Render as a separate service.
- Supabase is the source of truth for auth, storage, and database state.
- `JWT_SECRET` is required outside tests.

## Documentation

- [Project documentation](./docs/PROJECT_DOCUMENTATION.md)
- [Deployment guide](./docs/DEPLOYMENT_GUIDE.md)
- [Supabase setup guide](./docs/SUPABASE_SETUP_GUIDE.md)
- [Secrets and GitHub setup](./docs/SECRETS_AND_GITHUB_SETUP.md)
- [Prompt history and issue log](./docs/PROMPT_HISTORY_AND_ISSUE_LOG.md)

## Recent hardening

This repo now includes a security and cleanup pass that:

- removes the unsafe token-length auth bypass
- requires `JWT_SECRET` outside tests
- redacts demo bootstrap data by role
- tightens document and journal access behavior
- cleans stale local/dev artifacts from version control
- aligns the README and config with the live Netlify + Render + Supabase deployment

## Roadmap

- Further split large API route logic into smaller modules
- Add a more distinct secondary-caregiver dashboard experience
- Improve frontend code-splitting to reduce the main bundle size
- Expand Supabase-native invite, recovery, and realtime flows
