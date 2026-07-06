from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from app.models.company import Company
from app.schemas.company_research import CompanyResearchCreate


class AIProvider(ABC):
    name: str

    @abstractmethod
    def generate_company_research(self, company: Company, user_profile: Any | None = None) -> CompanyResearchCreate:
        """Return structured research. Providers must not decide whether the user should apply."""


class MockAIProvider(AIProvider):
    name = "mock"

    def generate_company_research(self, company: Company, user_profile: Any | None = None) -> CompanyResearchCreate:
        industry_label = {
            "maker": "manufacturing and product development",
            "finance": "financial services and risk management",
            "consulting": "client problem solving and business transformation",
            "it": "software, cloud, and digital services",
            "other": "cross-industry business",
        }.get(company.industry, "cross-industry business")
        difficulty = 5 if company.priority in {"S", "A"} else 3
        dx = 5 if company.industry in {"it", "consulting"} else 4
        global_score = 5 if company.industry in {"maker", "consulting"} else 3
        growth = 5 if company.industry in {"it", "consulting"} else 4
        stability = 5 if company.industry in {"maker", "finance"} else 3
        salary = 5 if company.industry in {"finance", "consulting", "it"} else 4
        work_life = 3 if company.industry in {"consulting", "finance"} else 4
        position = "Reach" if difficulty >= 5 else "Core" if company.priority in {"A", "B"} else "Safe"
        now = datetime.now(UTC)

        return CompanyResearchCreate(
            company_overview=(
                f"{company.name} is analyzed as a {industry_label} company. "
                "This mock research summarizes public-style company signals and CareerTrack data."
            ),
            business_summary=(
                f"The business appears connected to {industry_label}. "
                "Key review points are business model clarity, customer base, and how digital capabilities support growth."
            ),
            salary_level=salary,
            difficulty_level=difficulty,
            stability=stability,
            growth=growth,
            global_score=global_score,
            dx=dx,
            work_life_balance=work_life,
            recommended_people=(
                "May fit people who want to compare company strategy, selection requirements, "
                "and their own skills before making a decision."
            ),
            strengths=(
                "Clear business domain; useful for structured preparation; good target for comparing fit, "
                "selection risk, and career direction."
            ),
            weaknesses=(
                "Detailed salary, culture, and latest news should be verified from official sources before final judgment."
            ),
            selection_process=(
                "Typical flow may include entry sheet, aptitude/SPI-style screening, interviews, and final confirmation. "
                "Actual steps should be checked on the recruitment site."
            ),
            selection_points=(
                "Prepare a concise motivation story, connect experience to the company domain, "
                "and verify whether SPI/ES quality is a bottleneck."
            ),
            ai_strategy_position=position,
            research_summary=(
                f"{company.name} may have stronger fit for users interested in {industry_label}, DX, "
                "and structured selection preparation. AI is only organizing information; "
                "the final application decision should be made by the user."
            ),
            sources=[
                {
                    "title": f"{company.name} Recruitment Site",
                    "url": "https://example.com/recruitment",
                    "retrieved_at": now,
                },
                {
                    "title": f"{company.name} IR / Company Information",
                    "url": "https://example.com/ir",
                    "retrieved_at": now,
                },
            ],
            provider=self.name,
        )


def get_ai_provider(provider_name: str = "mock") -> AIProvider:
    providers: dict[str, AIProvider] = {
        "mock": MockAIProvider(),
    }
    return providers.get(provider_name, providers["mock"])
