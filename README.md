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

## Install

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign
npm install
```

## Start

Start the backend first at `http://127.0.0.1:8000`, then:

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
