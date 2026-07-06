from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CompanyResearch(Base):
    __tablename__ = "company_research"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    company_overview: Mapped[str] = mapped_column(Text, nullable=False)
    business_summary: Mapped[str] = mapped_column(Text, nullable=False)
    salary_level: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty_level: Mapped[int] = mapped_column(Integer, nullable=False)
    stability: Mapped[int] = mapped_column(Integer, nullable=False)
    growth: Mapped[int] = mapped_column(Integer, nullable=False)
    global_score: Mapped[int] = mapped_column("global", Integer, nullable=False)
    dx: Mapped[int] = mapped_column(Integer, nullable=False)
    work_life_balance: Mapped[int] = mapped_column(Integer, nullable=False)
    recommended_people: Mapped[str] = mapped_column(Text, nullable=False)
    research_summary: Mapped[str] = mapped_column(Text, nullable=False)
    strengths: Mapped[str] = mapped_column(Text, nullable=False)
    weaknesses: Mapped[str] = mapped_column(Text, nullable=False)
    selection_process: Mapped[str] = mapped_column(Text, nullable=False)
    selection_points: Mapped[str] = mapped_column(Text, nullable=False)
    ai_strategy_position: Mapped[str] = mapped_column(String(20), nullable=False)
    sources: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="research_entries")
    user = relationship("User", back_populates="company_research_entries")
