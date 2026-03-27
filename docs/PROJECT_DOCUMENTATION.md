# CareCircle AI Project Documentation

## Overview

CareCircle AI is a full-stack caregiving command center designed for family caregivers who need a calm, simple, and compassionate interface for daily care work. The product brings medications, journaling, documents, appointments, vitals, emergency planning, family coordination, and AI assistance into a single workflow.

The target user is intentionally non-technical. Every screen is meant to feel understandable in under 10 seconds, especially for a caregiver under stress.

## Canonical build prompt

The current authoritative build prompt for this repository is documented in [FINAL_PRODUCTION_BUILD_PROMPT.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/docs/FINAL_PRODUCTION_BUILD_PROMPT.md).

It is adapted to the actual monorepo and secure secret model used in this project.

## Product Purpose

CareCircle AI exists to reduce caregiver overload. Instead of forcing a family to juggle notes, chat threads, pill bottles, insurance paperwork, and memory, the product tries to turn the most important care tasks into a guided, readable system.

### Primary benefits

- Reduces missed medications through a visual schedule and adherence tracking
- Makes medical documents easier to understand through plain-English AI summaries
- Helps families coordinate care without scattered messages and duplicated effort
- Captures symptom and behavior observations in a structured journal
- Improves appointment preparation with recent notes, medications, and AI-suggested questions
- Gives caregivers faster access to emergency information when time matters
- Offers emotional support and guidance through a patient-aware AI chat assistant

## Intended User Profile

- Primary caregiver: daughter, spouse, or close family member
- Low technical confidence
- High emotional and logistical load
- Managing chronic conditions, aging-related needs, or cognitive decline

## Core Screens

### 1. Login and onboarding

- Demo-safe login with `demo@carecircle.ai / Demo1234`
- First-time onboarding flow
- Loved one profile setup
- Medication and family invite setup

### 2. Dashboard

- Time-aware greeting
- Daily AI briefing
- Medications today summary
- Next appointment summary
- Tasks due
- Last journal entry
- Quick actions
- Upcoming medications and appointments
- Recent AI insights
- Family activity feed

### 3. Medications

- Today schedule grouped by time of day
- Adherence summary
- Interaction checker
- Refill tracker
- Add/edit medication flows
- Medication logging with taken/missed state

### 4. Care Journal

- Modal-based journal entry creation
- Severity, mood, pain, tags, follow-up
- AI title generation
- AI single-entry analysis
- 30-day pattern analysis

### 5. Documents

- File upload
- Category selection
- PDF and image support
- OCR and PDF parsing
- AI summary, action items, important dates, and glossary

### 6. Appointments

- Calendar view
- Upcoming and past tabs
- Appointment prep notes
- AI-suggested doctor questions
- Follow-up note capture

### 7. Health Vitals

- Overview cards
- Trend charts
- Time-range filters
- AI analysis of readings
- Normal-range reference

### 8. Family Hub

- Member list
- Pending invites
- Shared activity feed
- Reactions
- Group chat
- Care coordination task board

### 9. Tasks

- Today, week, and overdue organization
- Assignment and recurrence
- Quick completion
- AI-suggested tasks

### 10. Emergency

- Quick access emergency actions
- Patient info card
- Emergency protocol library
- PDF export
- Share link
- QR code

### 11. Care Chat

- Floating chat button
- In-context AI assistant
- Session memory within browser session
- Emotional check-in flow

### 12. Settings

- Caregiver profile
- Patient profile
- Notifications
- Display preferences
- Help and support
- Feedback
- Data export
- Account deletion

## Technical Architecture

## Monorepo structure

```text
apps/
  api/        Express API and server-side services
  web/        React + Vite frontend
packages/
  shared/     Shared TypeScript types and demo data
supabase/
  migrations/ Schema
  seed.sql    Demo seed data
  storage.sql Storage policies and setup
docs/         Product, deployment, and issue documentation
```

## Frontend

- React 18
- Vite
- Tailwind CSS
- Framer Motion
- React Router
- Chart.js
- React Hot Toast
- Lucide React
- qrcode.react

The frontend is mobile-first and uses a persistent layout shell, modal-driven workflows, and high-contrast readable UI primitives.

## Backend

- Node.js
- Express
- Multer
- pdf-parse
- Tesseract.js
- jsPDF
- JSZip
- Nodemailer
- node-cron
- OpenAI SDK

The backend exposes REST endpoints for auth, bootstrap state, feature data, exports, documents, AI flows, and communication utilities.

## Database and storage

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage

The project also supports a demo fallback mode for local or judge-safe runs when external services are unavailable.

## Runtime model

CareCircle currently supports two runtime modes:

### 1. Demo-safe fallback mode

- Uses in-memory demo data and seeded types
- Works locally even without full external services
- Useful for judges, demos, and offline development

### 2. Supabase-backed mode

- Uses Supabase Auth, database, and storage
- Uses API endpoints for persistence and server-side processing
- Intended for public demo deployment

## Shared domain model

The schema includes the requested caregiving entities plus supporting collaboration entities.

### Core caregiving tables

- `users`
- `patients`
- `medications`
- `medication_logs`
- `care_journal`
- `documents`
- `appointments`
- `family_members`
- `tasks`
- `emergency_protocols`
- `health_vitals`
- `ai_insights`
- `notifications`

### Supporting collaboration and settings tables

- `chat_sessions`
- `chat_messages`
- `feedback`
- `family_activity_log`
- `family_activity_reactions`
- `family_messages`
- `pending_email_updates`

## API surface

The API is grouped by feature area rather than by technical layer.

### Auth and session

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`

### Bootstrap and shell

- `GET /api/bootstrap`
- `GET /api/meta`
- `GET /api/health`

### Feature routes

- Dashboard
- Medications
- Journal
- Documents
- Appointments
- Vitals
- Family
- Tasks
- Emergency
- Care Chat
- Settings
- Notifications
- Exports

See [server.ts](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/apps/api/src/server.ts) for the current route inventory.

## AI-assisted features

CareCircle uses AI as a support layer, not as a replacement for clinicians.

### AI workflows in the product

- Daily caregiver briefing
- Medication interaction checks
- Journal title generation
- Journal single-entry analysis
- 30-day care pattern analysis
- Document interpretation
- Appointment question suggestions
- Appointment prep summary emails
- Post-appointment extraction support
- Vitals trend analysis
- AI task suggestions
- Emergency protocol generation
- Weekly family summary
- Care chat assistant
- Caregiver emotional check-ins

## Accessibility and UX principles

The app is intentionally designed around caregiver stress and low technical confidence.

### UX principles

- Calm, clear, caring
- No essential feature should require instructions
- Important actions visible quickly
- Plain-language validation and feedback
- Mobile usability at narrow widths

### Accessibility work included

- Minimum readable base font sizing
- Focus rings on interactive elements
- Large touch targets
- Explicit labels on form fields
- Escape-close modals
- Descriptive alt text where relevant
- Semantic layout landmarks

## Authentication and session behavior

The app now includes a real login gate and a demo-safe login path.

### Demo login

- Email: `demo@carecircle.ai`
- Password: `Demo1234`

### Important note

The login flow requires the backend API to be running. The frontend alone cannot authenticate users because the current architecture is not frontend-only.

## Environment variables

Current required and optional variables are listed in [.env.example](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/.env.example).

### Key groups

- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`
- Supabase server: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- Frontend client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
- Auth and security: `JWT_SECRET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Runtime URLs: `FRONTEND_URL`, `BACKEND_URL`
- Storage: `SUPABASE_STORAGE_BUCKET`
- Server port: `PORT`

## Local development workflow

### Install and run

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

### Local URLs

- Frontend: `http://localhost:5173` or the next available Vite port
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

## Testing

### Available commands

```powershell
npm run build
npm run test
npm run test:e2e
```

### Coverage areas

- API tests with Supertest and Vitest
- Frontend component and interaction tests with Vitest and Testing Library
- Browser smoke tests with Playwright

## Product impact and value

This product is meaningful because it addresses real caregiver pain, not novelty features.

### Real-world value

- Lowers cognitive load by putting care tasks in one place
- Encourages consistent logging that makes doctor visits more useful
- Gives multiple family members a shared source of truth
- Makes emergency information faster to access
- Translates medical language into everyday language
- Helps caregivers feel less alone and more supported

### For judges, recruiters, or stakeholders

The strongest story of the product is not only that it uses AI, but that it uses AI in service of clarity, safety, and emotional support.

## Current project status

## What is ready now

- Strong portfolio and demo project
- Publicly deployable as a beta/demo
- Good fit for a hackathon, capstone, portfolio, or judge review
- Realistic architecture for future expansion

## What is not fully complete for true healthcare-grade production

- No formal HIPAA review or compliance program
- No BAA setup or verified compliant infrastructure process
- No security audit, penetration testing, or formal threat model
- No production monitoring, alerting, tracing, or incident response process
- No rate limiting or abuse hardening sufficient for open public traffic
- AI outputs are helpful but not clinically validated
- Some flows still rely on demo fallback behavior rather than fully hardened live infrastructure
- Cross-device/browser QA is good locally but not enterprise-grade

## Honest readiness assessment

### Portfolio/demo ready

Yes.

### Public beta for limited testers

Yes, with clear disclaimer language and a small controlled audience.

### Final production-ready for general public healthcare use

No, not yet.

## Recommended next steps to reach stronger production readiness

1. Finish remaining Supabase-first persistence and realtime coverage end to end.
2. Add proper error monitoring, logging, and health alerting.
3. Add robust rate limiting, CSRF/session hardening, and audit trails.
4. Add full account recovery, invite acceptance, email verification, and password reset flows.
5. Add stronger export, retention, and data deletion guarantees.
6. Add clinician-reviewed content guardrails for AI outputs.
7. Complete browser and device QA across Safari, Chrome, Edge, and Android/iPhone breakpoints.
8. Add deployment automation and post-deploy smoke checks.

## Key files to know

- [README.md](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/README.md)
- [server.ts](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/apps/api/src/server.ts)
- [App.tsx](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/apps/web/src/App.tsx)
- [AppDataContext.tsx](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/apps/web/src/context/AppDataContext.tsx)
- [types.ts](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/packages/shared/src/types.ts)
- [0001_init.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/migrations/0001_init.sql)
- [seed.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/seed.sql)
- [storage.sql](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/supabase/storage.sql)
