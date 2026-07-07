from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.routers import advisor, auth, companies, dashboard, decision, events, notifications, profile, strategy, tasks


settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def startup() -> None:
    init_db()


app.include_router(auth.router)
app.include_router(advisor.router)
app.include_router(companies.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(decision.router)
app.include_router(notifications.router)
app.include_router(profile.router)
app.include_router(strategy.router)
app.include_router(tasks.router)
