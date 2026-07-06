from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    education: Mapped[str | None] = mapped_column(Text, nullable=True)
    major: Mapped[str | None] = mapped_column(Text, nullable=True)
    research_theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    research_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    programming_languages: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    frameworks: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    projects: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    internship_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    qualifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    certifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    interests: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_industries: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_jobs: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_locations: Mapped[str | None] = mapped_column(Text, nullable=True)
    global_interest: Mapped[str | None] = mapped_column(Text, nullable=True)
    career_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    self_strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    self_weaknesses: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="profile")
