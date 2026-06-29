# Recruitment App FastAPI Backend

FastAPI backend for the recruitment management app.

## Implemented scope

- User registration/login with JWT bearer authentication
- bcrypt password hashing
- Authenticated `GET /auth/me`
- Company CRUD scoped to the authenticated user
- Event CRUD scoped to the authenticated user
- Dashboard summary derived from the authenticated user's companies and events
- SQLite for local development
- pytest coverage using temporary SQLite databases

## Environment

Copy the example file:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
Copy-Item .env.example .env
```

Important values:

```text
ENVIRONMENT=development
DATABASE_URL=sqlite:///./app.db
FRONTEND_ORIGIN=http://localhost:3000
JWT_SECRET_KEY=
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Local development can omit `JWT_SECRET_KEY`. Non-local environments must set a long random `JWT_SECRET_KEY` and `FRONTEND_ORIGIN`.

## Install

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Start

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open:

- Health check: `http://127.0.0.1:8000/health`
- Swagger UI: `http://127.0.0.1:8000/docs`

## Run tests

The pytest suite uses a temporary SQLite database for each test and does not modify `app.db`.

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
.venv\Scripts\python.exe -m pytest
```

## Compile check

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
.venv\Scripts\python.exe -m compileall app tests
```

## Docker

Build the backend image:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
docker build -t recruitment-backend:local .
```

Run the image directly:

```powershell
docker run --rm -p 8000:8000 `
  -e ENVIRONMENT=development `
  -e DATABASE_URL=sqlite:////data/app.db `
  -e JWT_SECRET_KEY=local-docker-secret-change-before-production `
  -e FRONTEND_ORIGIN=http://localhost:3000 `
  recruitment-backend:local
```

Run with Docker Compose:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\backend
docker compose up --build
```

Stop Docker Compose:

```powershell
docker compose down
```

Compose uses SQLite locally through the named volume `backend-sqlite-data`. PostgreSQL is not included in the local compose file yet.

Container environment variables:

- `ENVIRONMENT`: `development` locally, `production` on AWS/Render.
- `DATABASE_URL`: SQLite locally, PostgreSQL URL in production.
- `JWT_SECRET_KEY`: required for containers and production; use a long random value.
- `FRONTEND_ORIGIN`: frontend origin allowed by CORS.
- `PORT`: optional container port for uvicorn, defaults to `8000`. Render provides this automatically.

## Production deployment notes

For AWS production deployment, keep local SQLite for development and set production environment variables on the hosting service:

```text
ENVIRONMENT=production
DATABASE_URL=postgresql://user:password@your-rds-endpoint:5432/recruitment_app
FRONTEND_ORIGIN=https://your-frontend-domain.example.com
JWT_SECRET_KEY=replace-with-a-long-random-secret
```

Notes:

- `DATABASE_URL` controls the database backend. SQLite works locally; PostgreSQL is supported for production through `psycopg2-binary`.
- In non-local environments, CORS allows only `FRONTEND_ORIGIN`.
- `JWT_SECRET_KEY` is required outside local development.
- Alembic migrations are not configured yet. The current app creates tables at startup with SQLAlchemy metadata.

## Render deployment

The backend Dockerfile is compatible with Render Web Services. It starts uvicorn on `0.0.0.0` and respects Render's `PORT` environment variable:

```text
uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
```

Recommended Render settings:

- Service type: Web Service
- Runtime: Docker
- Root Directory: `backend`
- Dockerfile Path: `backend/Dockerfile` if deploying from the repository root, or `Dockerfile` if the Render root directory is already `backend`
- Health Check Path: `/health`

Required Render environment variables:

```text
ENVIRONMENT=production
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
FRONTEND_ORIGIN=https://your-frontend-domain.example.com
JWT_SECRET_KEY=replace-with-a-long-random-secret
```

Notes:

- Do not set `PORT` manually unless Render asks for it; Render injects it at runtime.
- `DATABASE_URL` may point to Supabase PostgreSQL or another PostgreSQL provider.
- In production, CORS allows only `FRONTEND_ORIGIN`, so set it to the exact deployed frontend origin.
- After deployment, verify `https://your-render-service.onrender.com/health` returns `{"status":"ok"}`.

## Supabase PostgreSQL

The backend can use Supabase PostgreSQL in production through `DATABASE_URL`. SQLite remains the default when `DATABASE_URL` is not set.

To obtain a Supabase database URL:

1. Open your Supabase project dashboard.
2. Go to the database connection settings.
3. Copy a PostgreSQL connection string. The pooled connection string is usually a good fit for deployed web apps.
4. Replace the password placeholder with your database password.
5. Keep `sslmode=require` in the URL, or append `?sslmode=require` if it is not present.

Example `.env` for Supabase:

```text
ENVIRONMENT=production
DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-your-region.pooler.supabase.com:6543/postgres?sslmode=require
FRONTEND_ORIGIN=https://your-frontend-domain.example.com
JWT_SECRET_KEY=replace-with-a-long-random-secret
```

Start FastAPI against Supabase:

```powershell
cd C:\Users\yuzu5\Documents\Codex\2026-06-25\fastapi-next-js-web-fastapi-sqlite\work\recruitment-app-redesign\backend
Copy-Item .env.example .env
# Edit .env with your Supabase DATABASE_URL, FRONTEND_ORIGIN, and JWT_SECRET_KEY.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

On first startup, `Base.metadata.create_all()` creates the required `users`, `companies`, and `events` tables if they do not already exist. Alembic migrations are intentionally not configured yet.

## API smoke check

Register:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/auth/register -ContentType application/json -Body '{"email":"taro@example.com","password":"password123","name":"就活 太郎","graduation_year":2027}'
```

Login:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/auth/login -ContentType application/json -Body '{"email":"taro@example.com","password":"password123"}'
$token = $login.access_token
```

Current user:

```powershell
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:8000/auth/me -Headers @{ Authorization = "Bearer $token" }
```
