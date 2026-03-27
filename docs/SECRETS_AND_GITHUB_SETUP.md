# CareCircle AI Secrets, GitHub, and Safe Deployment Setup

## Read this first

Some of the values you pasted are true secrets, not normal config values.

That means they should **never** be:

- committed to GitHub
- pasted into frontend `VITE_*` variables
- stored in browser code
- shared in chat, screenshots, or README files

The two local secret dump files currently sitting in the repo folder:

- `Api s.txt`
- `Supabase.txt`

must remain local-only and gitignored.

## Immediate action: rotate the exposed secrets

Because live secrets were shared outside your private local environment, you should rotate these immediately in their dashboards:

- OpenAI API key
- Resend API key
- Supabase service role key
- Supabase secret key
- Supabase database password
- Legacy JWT secret, if it is still active anywhere you control

## Which values are safe on the frontend

These are normal client-side values and can be used in the React app:

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These should **not** be considered secret.

## Which values must stay server-side only

These must never go into `VITE_*` variables:

- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_KEY`
- database passwords
- JWT signing secrets
- any secret or service role key

If a value can create data, delete data, send mail, or bypass permissions, it belongs on the server only.

## Important correction to the prompt you pasted

The instruction block you pasted suggested using:

- `VITE_OPENAI_API_KEY`
- `VITE_RESEND_API_KEY`

That is not safe for this project.

For this codebase, keep:

- OpenAI on the backend API or secure server-side functions
- email sending on the backend API or secure server-side functions
- Supabase service-role access on the backend only

## Safe file layout for this repo

This repo is a monorepo and does **not** use a `frontend/` folder. The correct paths here are:

- frontend app: `apps/web`
- backend API: `apps/api`
- shared package: `packages/shared`

### Safe frontend env example

Use [apps/web/.env.example](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/apps/web/.env.example) as the frontend template.

### Safe backend env example

Use [.env.example](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/.env.example) as the backend and shared runtime template.

## Recommended local setup

### 1. Frontend local env

Create `apps/web/.env.local` locally with only:

```env
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key_here
```

### 3. Secret dump files

If you keep `Api s.txt` and `Supabase.txt` locally for reference, do not rename or move them into tracked folders, and never stage them for commit.

### 2. Backend local env

Create root `.env` locally with server-side values such as:

```env
OPENAI_API_KEY=your_server_only_openai_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_publishable_key_here
SUPABASE_SERVICE_KEY=your_server_only_service_key
JWT_SECRET=your_server_only_jwt_secret
SMTP_HOST=your-mail-host
SMTP_PORT=587
SMTP_USER=your-mail-user
SMTP_PASS=your-mail-password
FRONTEND_URL=http://localhost:5173,http://localhost:5174
BACKEND_URL=http://localhost:4000
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key_here
```

## GitHub safety checklist

Before pushing:

1. Confirm [.gitignore](/c:/Users/dellf/Downloads/Codex_Creator_Challenge/.gitignore) includes `.env`, `.env.local`, `.env.*.local`, and frontend env files.
2. Run `git status`.
3. Make sure no `.env`, `.env.local`, `apps/web/.env.local`, or secret dump files appear.
4. Search the repo for suspicious strings before pushing.

### Helpful local check

```powershell
rg -n "sk-|re_|sb_secret_|service_role|JWT|password" -S .
```

Then review results carefully before you push.

## Safe GitHub flow

```powershell
git init
git add .
git status
git commit -m "Initial commit - CareCircle AI"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## Netlify environment variables

On Netlify, set only frontend-safe values:

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do **not** set OpenAI or Resend as `VITE_*` variables in the browser app.

## Backend host environment variables

On Render, Railway, or another Node host, set the true server-side secrets:

- `OPENAI_API_KEY`
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

## Bottom line

Use this rule everywhere:

> If the browser can read it, it is not secret.

That single rule will protect you from most accidental key leaks.
