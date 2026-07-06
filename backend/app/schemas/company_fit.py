from pydantic import BaseModel, Field


class FitScore(BaseModel):
    score: int = Field(ge=0, le=100)
    reason: str


class CompanyFitAnalysis(BaseModel):
    overall_fit_score: int = Field(ge=0, le=100)
    research_match: FitScore
    skill_match: FitScore
    project_match: FitScore
    career_match: FitScore
    global_match: FitScore
    learning_opportunity: FitScore
    risk_score: FitScore
    system_note: str = "CareerTrack System Analysis. This is rule-based fit analysis, not AI-generated advice."
