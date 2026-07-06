from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    priority: Mapped[str] = mapped_column(String(1), nullable=False, default="C")
    importance: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="planned")
    es_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategy_rank: Mapped[str] = mapped_column(String(1), nullable=False, default="A")
    difficulty_level: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    fit_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    success_probability: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    selection_risk: Mapped[str] = mapped_column(String(20), nullable=False, default="Unknown")
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategy_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_strategy_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    es_motivation_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    es_research_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    es_project_connection: Mapped[str | None] = mapped_column(Text, nullable=True)
    es_appeal_points: Mapped[str | None] = mapped_column(Text, nullable=True)
    es_missing_information: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_expected_questions: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_stories: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_reverse_questions: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_reflection: Mapped[str | None] = mapped_column(Text, nullable=True)
    personal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="companies")
    events = relationship("Event", back_populates="company")
    tasks = relationship("Task", back_populates="related_company")
    research_entries = relationship("CompanyResearch", back_populates="company", cascade="all, delete-orphan")
