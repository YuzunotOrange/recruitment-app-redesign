from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="system")
    related_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    is_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="notifications")


class ReminderSettings(Base):
    __tablename__ = "reminder_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    deadline_7days: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deadline_3days: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deadline_1day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    interview_1day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    interview_30min: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    es_deadline_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    interview_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    internship_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    info_session_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    offer_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    weekly_summary_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    weekly_summary_last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="reminder_settings")
