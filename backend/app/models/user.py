from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    theme: Mapped[str] = mapped_column(String(20), nullable=False, default="light", server_default="light")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    companies = relationship("Company", back_populates="user", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    company_research_entries = relationship("CompanyResearch", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", cascade="all, delete-orphan", uselist=False)
    reminder_settings = relationship(
        "ReminderSettings",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
