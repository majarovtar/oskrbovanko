# Oskrbovanko

MojOdpust makes a daily AI check-in voice call to elderly patients after hospital discharge. The call is
in Slovenian. The backend stores the answers, vitals and a severity for each call, and raises an alert
when something is wrong.

This is a hand-written rewrite of the original hackathon prototype, with no code-generation pipeline
involved: the backend and portal are ordinary, directly-maintained source.

## Modules

| Module | Stack | What it is |
|---|---|---|
| `backend/` | Python 3.12, FastAPI, SQLAlchemy 2 + psycopg 3 on Supabase Postgres | API, voice call bridge, browser call page |
| `portal/` | React + Vite + TypeScript | Dashboard for caregivers and doctors (UI still to come) |

## Backend

- Patients, question sets (`free_text` / `yes_no` / `scale_0_10` with flag rules), vitals and calls.
- Severity assessment (`normal` / `critical`) from emergency phrases, flagged answers and out-of-range vitals.
- Accounts with `doctor` / `caregiver` roles, JWT login, per-patient access rules, admin and service keys.
- The voice call: `GET /patients/{id}/call-script`, the `/patients/{id}/call-stream` WebSocket bridging
  audio to Azure Voice Live, and a `/call` browser page the patient uses to take the call.
- Critical calls send an email via Resend to the configured recipient.

Run it:

```bash
cd backend && uv sync --frozen
uv run --env-file ../.env uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Settings come from `.env` at the repo root; see `.env.example`.

## Portal

Scaffolded (API client, hooks, pages, routes) but the UI itself is still to be built.

```bash
cd portal && npm install && npm run dev
```
