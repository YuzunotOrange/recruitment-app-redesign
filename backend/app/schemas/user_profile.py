from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserProfileBase(BaseModel):
    education: str | None = None
    major: str | None = None
    research_theme: str | None = None
    research_summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    programming_languages: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    internship_experience: str | None = None
    qualifications: str | None = None
    certifications: str | None = None
    interests: str | None = None
    preferred_industries: str | None = None
    preferred_jobs: str | None = None
    preferred_locations: str | None = None
    global_interest: str | None = None
    career_goal: str | None = None
    self_strengths: str | None = None
    self_weaknesses: str | None = None


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfileRead(UserProfileBase):
    user_id: int
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
