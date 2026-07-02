# Recruitment App Frontend

Next.js frontend for the recruitment management app.

## Package manager

Use npm for frontend dependencies and scripts.

## Environment

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign
copy .env.local.example .env.local
```

Default:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Production auth/session settings:

```text
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
BACKEND_CORS_ORIGINS=https://your-vercel-app.vercel.app
JWT_SECRET_KEY=replace-with-a-long-random-secret
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
```

On Vercel, the frontend uses the same-origin `/api/backend` proxy by default so iPhone/iPad browsers keep the HttpOnly session cookie as a first-party cookie. Set `BACKEND_API_BASE_URL` to the Render/FastAPI URL when it differs from the default. For local development, keep `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`; cookies use `Secure=false` and `SameSite=Lax`.


## Install

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign
npm install
```

## Start

Start the backend first at `http://127.0.0.1:8000`. Before starting FastAPI, run backend migrations:

```powershell
cd backend
alembic upgrade head
```

Then start the frontend:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign
npm run dev
```

Open `http://localhost:3000`.

## Checks

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign
npx tsc --noEmit --incremental false
npm run build
```

## E2E smoke test

Start the backend and frontend first.

Terminal 1:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign
npm run dev
```

Terminal 3:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign
npm run e2e
```

The smoke test registers a user, creates a company, creates an event, verifies dashboard data, and logs out if possible.
