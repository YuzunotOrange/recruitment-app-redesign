from collections.abc import Iterable

from app.models.company import Company
from app.models.company_research import CompanyResearch
from app.models.user_profile import UserProfile
from app.schemas.company_fit import CompanyFitAnalysis, FitScore


TECH_TERMS = {"python", "fastapi", "react", "typescript", "javascript", "api", "web", "ai", "data", "dx"}
RESEARCH_TERMS = {"ai", "人工知能", "データ", "data", "解析", "analysis", "機械学習", "machine learning", "dx"}
GLOBAL_TERMS = {"global", "overseas", "海外", "international", "グローバル"}


def _clamp(value: int) -> int:
    return max(0, min(100, value))


def _lower(value: str | None) -> str:
    return (value or "").lower()


def _items(values: list[str] | None) -> list[str]:
    return [item.lower() for item in values or [] if item]


def _contains_any(text: str, terms: Iterable[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def _research_text(research: CompanyResearch | None) -> str:
    if research is None:
        return ""
    return " ".join(
        [
            research.company_overview,
            research.business_summary,
            research.recommended_people,
            research.research_summary,
            research.strengths,
            research.selection_process,
            research.selection_points,
        ]
    ).lower()


def _profile_text(profile: UserProfile | None) -> str:
    if profile is None:
        return ""
    return " ".join(
        [
            profile.education or "",
            profile.major or "",
            profile.research_theme or "",
            profile.research_summary or "",
            profile.internship_experience or "",
            profile.qualifications or "",
            profile.certifications or "",
            profile.interests or "",
            profile.preferred_industries or "",
            profile.preferred_jobs or "",
            profile.preferred_locations or "",
            profile.global_interest or "",
            profile.career_goal or "",
            profile.self_strengths or "",
            profile.self_weaknesses or "",
            " ".join(profile.skills or []),
            " ".join(profile.programming_languages or []),
            " ".join(profile.frameworks or []),
            " ".join(profile.projects or []),
        ]
    ).lower()


def _preferred_industry_matches(company: Company, profile: UserProfile | None) -> bool:
    preferred = _lower(profile.preferred_industries if profile else None)
    industry = _lower(company.industry)
    industry_words = {
        "it": {"it", "software", "web", "tech", "technology", "dx", "エンジニア", "開発"},
        "consulting": {"consulting", "consultant", "コンサル", "consult"},
        "finance": {"finance", "bank", "金融", "証券"},
        "maker": {"maker", "manufacturer", "製造", "メーカー"},
        "other": {"other"},
    }.get(industry, {industry})
    return industry in preferred or any(word in preferred for word in industry_words)


def _preferred_job_matches(profile: UserProfile | None, research_text: str) -> bool:
    preferred = _lower(profile.preferred_jobs if profile else None)
    if not preferred:
        return False
    job_terms = {"engineer", "developer", "software", "web", "data", "ai", "consultant", "企画", "開発", "エンジニア"}
    return _contains_any(preferred, job_terms) and (not research_text or _contains_any(research_text, job_terms | TECH_TERMS))


class CompanyFitService:
    def analyze(
        self,
        company: Company,
        research: CompanyResearch | None,
        profile: UserProfile | None,
        peer_companies: list[Company] | None = None,
    ) -> CompanyFitAnalysis:
        profile_text = _profile_text(profile)
        research_text = _research_text(research)
        has_profile = profile is not None and bool(profile_text.strip())
        has_research = research is not None

        research_score = 20 if has_profile else 0
        research_reasons: list[str] = []
        if not has_profile:
            research_reasons.append("User Profile is not filled yet, so personal research fit is limited.")
        if not has_research:
            research_reasons.append("Company Research is not generated yet; this uses company basics only.")
        if _contains_any(profile_text, RESEARCH_TERMS) and research and research.dx >= 4:
            research_score += 35
            research_reasons.append("Your research theme includes AI/data/analysis and the company has strong DX signals.")
        if _preferred_industry_matches(company, profile):
            research_score += 20
            research_reasons.append("Your preferred industries align with this company industry.")
        if has_research and _contains_any(research_text, profile_text.split()[:12]):
            research_score += 10
            research_reasons.append("Some profile keywords appear in the company research summary.")
        if not research_reasons:
            research_reasons.append("Research fit is calculated from your profile and company research.")

        skill_terms = set(_items(profile.skills if profile else []))
        skill_terms.update(_items(profile.programming_languages if profile else []))
        skill_terms.update(_items(profile.frameworks if profile else []))
        matched_tech = sorted(term for term in TECH_TERMS if any(term in skill for skill in skill_terms))
        dx_company = bool(research and research.dx >= 4) or company.industry == "it"
        skill_score = 15 if has_profile else 0
        skill_reasons: list[str] = []
        if matched_tech:
            skill_score += min(45, len(matched_tech) * 10)
            skill_reasons.append(f"Your technical skills match CareerTrack's DX rule set: {', '.join(matched_tech)}.")
        if matched_tech and dx_company:
            skill_score += 20
            skill_reasons.append("Technical skills are weighted higher because this company has IT/DX relevance.")
        if not skill_reasons:
            skill_reasons.append("Add skills, languages, and frameworks in Profile to improve skill matching.")

        project_text = " ".join(_items(profile.projects if profile else []))
        project_score = 15 if has_profile else 0
        project_reasons: list[str] = []
        if _contains_any(project_text, {"web", "app", "api", "ai", "data", "dashboard", "careertrack", "react", "fastapi"}):
            project_score += 45
            project_reasons.append("Your project experience includes web/app/API/AI/data keywords.")
        if dx_company and project_score > 15:
            project_score += 20
            project_reasons.append("Project experience is relevant to an IT/DX-oriented company.")
        if not project_reasons:
            project_reasons.append("Project match is low until project details are added to Profile.")

        career_score = 10 if has_profile else 0
        career_reasons: list[str] = []
        if _preferred_industry_matches(company, profile):
            career_score += 25
            career_reasons.append("Preferred industry and company industry are aligned.")
        if _preferred_job_matches(profile, research_text):
            career_score += 25
            career_reasons.append("Preferred job direction is compatible with the company research context.")
        if profile and profile.career_goal and _contains_any(research_text + " " + company.name.lower(), profile.career_goal.lower().split()):
            career_score += 10
            career_reasons.append("Career goal keywords overlap with the company context.")
        if not career_reasons:
            career_reasons.append("Career fit is based on preferred industries, preferred jobs, and career goal.")

        global_score = 20 if has_profile else 0
        global_reasons: list[str] = []
        wants_global = _contains_any(_lower(profile.global_interest if profile else None), GLOBAL_TERMS | {"yes", "true", "あり", "興味"})
        company_global = research.global_score if research else 0
        if wants_global and company_global >= 4:
            global_score += 55
            global_reasons.append("Your global interest aligns with the company's global business score.")
        elif wants_global:
            global_score += 25
            global_reasons.append("You have global interest, but the company global signal is not strong yet.")
        else:
            global_reasons.append("Global match increases when Profile global interest and company global score align.")

        learning_score = 30 if has_research else 20
        learning_reasons: list[str] = []
        if research:
            learning_score += research.growth * 8
            learning_score += research.dx * 4
            learning_reasons.append("Learning opportunity uses company growth and DX scores from Company Research.")
            if research.difficulty_level >= 4:
                learning_score += 8
                learning_reasons.append("Higher selection difficulty may also indicate a stronger learning environment.")
        else:
            learning_reasons.append("Generate Company Research to calculate learning opportunity more accurately.")

        risk_score = 10
        risk_reasons: list[str] = []
        difficulty = research.difficulty_level if research else company.difficulty_level
        risk_score += difficulty * 10
        if difficulty >= 5:
            risk_reasons.append("Selection difficulty is very high.")
        spi_rejected_count = sum(1 for item in peer_companies or [] if item.status == "spi_rejected")
        if spi_rejected_count >= 3:
            risk_score += 25
            risk_reasons.append("SPI rejections are frequent across your portfolio.")
        if company.selection_risk != "Unknown":
            risk_score += 10
            risk_reasons.append(f"Main risk is currently marked as {company.selection_risk}.")
        if not risk_reasons:
            risk_reasons.append("Risk uses selection difficulty, portfolio rejection patterns, and company risk labels.")

        component_scores = [
            _clamp(research_score),
            _clamp(skill_score),
            _clamp(project_score),
            _clamp(career_score),
            _clamp(global_score),
            _clamp(learning_score),
        ]
        fit_without_risk = round(sum(component_scores) / len(component_scores))
        overall = _clamp(round((fit_without_risk * 0.85) + ((100 - _clamp(risk_score)) * 0.15)))

        return CompanyFitAnalysis(
            overall_fit_score=overall,
            research_match=FitScore(score=_clamp(research_score), reason=" ".join(research_reasons)),
            skill_match=FitScore(score=_clamp(skill_score), reason=" ".join(skill_reasons)),
            project_match=FitScore(score=_clamp(project_score), reason=" ".join(project_reasons)),
            career_match=FitScore(score=_clamp(career_score), reason=" ".join(career_reasons)),
            global_match=FitScore(score=_clamp(global_score), reason=" ".join(global_reasons)),
            learning_opportunity=FitScore(score=_clamp(learning_score), reason=" ".join(learning_reasons)),
            risk_score=FitScore(score=_clamp(risk_score), reason=" ".join(risk_reasons)),
        )
