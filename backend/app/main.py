import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.routers import advisor, auth, companies, dashboard, decision, events, notifications, profile, push, strategy, tasks
from app.services.reminder_scheduler import run_scheduled_deliveries


logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title=settings.app_name)
_reminder_email_stop_event = threading.Event()

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


def _reminder_delivery_loop(interval_seconds: int) -> None:
    while not _reminder_email_stop_event.wait(interval_seconds):
        db = SessionLocal()
        try:
            run_scheduled_deliveries(db)
        except Exception:
            logger.exception("Reminder delivery loop failed")
        finally:
            db.close()


@app.on_event("startup")
def startup() -> None:
    init_db()
    # Email needs SMTP config, but web push works out of the box, so always run the loop.
    interval_seconds = max(60, settings.reminder_email_interval_minutes * 60)
    threading.Thread(target=_reminder_delivery_loop, args=(interval_seconds,), daemon=True).start()


@app.on_event("shutdown")
def shutdown() -> None:
    _reminder_email_stop_event.set()


app.include_router(auth.router)
app.include_router(advisor.router)
app.include_router(companies.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(decision.router)
app.include_router(notifications.router)
app.include_router(profile.router)
app.include_router(push.router)
app.include_router(strategy.router)
app.include_router(tasks.router)
