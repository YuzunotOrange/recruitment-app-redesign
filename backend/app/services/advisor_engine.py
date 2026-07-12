from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.models.company import Company
from app.models.company_research import CompanyResearch
from app.models.event import Event
from app.models.notification import Notification
from app.schemas.advisor import (
    AdvisorAction,
    AdvisorApplicationBalance,
    AdvisorDeadlineAlert,
    AdvisorRiskMonitor,
    AdvisorSummary,
)
from app.services.notifications import ES_PENDING_STATUSES


STRATEGY_POSITIONS = ("Reach", "Core", "Safe", "Hold")
INTERVIEW_STATUSES = {
    "interview",
    "first_interview_scheduled",
    "first_interview_passed",
    "second_interview_scheduled",
    "second_interview_passed",
    "final_interview_scheduled",
    "final_interview_passed",
}
ACTIVE_POSITIONS = ("Reach", "Core", "Safe")


def _memo_block(source: str | None, label: str) -> str:
    if not source:
        return ""
    marker = f"[{label}]\n"
    start = source.find(marker)
    if start == -1:
        return ""
    rest = source[start + len(marker) :]
    next_block = rest.find("\n\n[")
    return (rest[:next_block] if next_block != -1 else rest).strip()


def _system_position(company: Company) -> str:
    if company.status == "declined" or company.success_probability < 30:
        return "Hold"
    if company.strategy_rank == "S":
        return "Reach"
    if company.strategy_rank == "B":
        return "Safe"
    return "Core"


def _strategy_position(company: Company) -> str:
    stored = _memo_block(company.user_strategy_note, "Strategy Position")
    return stored if stored in STRATEGY_POSITIONS else _system_position(company)


def _risk_level(count: int, medium_at: int = 1, high_at: int = 3) -> str:
    if count >= high_at:
        return "high"
    if count >= medium_at:
        return "medium"
    return "low"


class AdvisorEngine:
    """Rule-based career advisor. It proposes priorities but never makes the user's decision."""

    def build_summary(
        self,
        *,
        companies: list[Company],
        events: list[Event],
        notifications: list[Notification],
        research_entries: list[CompanyResearch],
    ) -> AdvisorSummary:
        today = datetime.now(UTC).date()
        week_end = today + timedelta(days=7)

        es_rejected = sum(1 for company in companies if company.status == "es_rejected")
        spi_rejected = sum(1 for company in companies if company.status == "spi_rejected")
        offers = sum(1 for company in companies if company.status in {"offer", "internship_offer"})
        interview_events = [event for event in events if event.type == "interview"]
        interview_company_count = sum(1 for company in companies if company.status in INTERVIEW_STATUSES)
        upcoming_events = [event for event in events if event.start_date >= today]
        unread_notifications = sum(1 for notification in notifications if not notification.is_read)
        accepted_research = sum(1 for research in research_entries if research.accepted)
        researched_company_ids = {research.company_id for research in research_entries}
        accepted_research_company_ids = {research.company_id for research in research_entries if research.accepted}
        unresearched_companies = [company for company in companies if company.id not in researched_company_ids]
        undecided_research_count = len(researched_company_ids - accepted_research_company_ids)

        deadline_alerts = self._deadline_alerts(companies=companies, events=events, today=today, week_end=week_end)
        position_counts = {position: 0 for position in STRATEGY_POSITIONS}
        for company in companies:
            position_counts[_strategy_position(company)] += 1

        balance = self._application_balance(position_counts)
        missing_portfolio = self._missing_portfolio(position_counts)

        main_issue, reason = self._main_issue(
            spi_rejected=spi_rejected,
            es_rejected=es_rejected,
            interview_count=len(interview_events) + interview_company_count,
            deadline_count=len(deadline_alerts),
            missing_portfolio=missing_portfolio,
            offer_count=offers,
            total_companies=len(companies),
        )

        risk_monitor = AdvisorRiskMonitor(
            es=_risk_level(es_rejected, high_at=3),
            spi=_risk_level(spi_rejected, high_at=3),
            interview="medium" if companies and len(interview_events) + interview_company_count == 0 else ("low" if len(interview_events) + interview_company_count >= 3 else "medium"),
            deadline=_risk_level(len(deadline_alerts), medium_at=1, high_at=3),
        )

        todays_mission = self._todays_mission(main_issue=main_issue, deadline_alerts=deadline_alerts, interview_events=interview_events, today=today)
        this_week = self._this_week(
            main_issue=main_issue,
            missing_portfolio=missing_portfolio,
            unread_notifications=unread_notifications,
            accepted_research=accepted_research,
            upcoming_events=upcoming_events,
            unresearched_companies=unresearched_companies,
            undecided_research_count=undecided_research_count,
        )
        suggested_improvements = self._suggested_improvements(
            es_rejected=es_rejected,
            spi_rejected=spi_rejected,
            interview_count=len(interview_events) + interview_company_count,
            accepted_research=accepted_research,
            missing_portfolio=missing_portfolio,
            unresearched_count=len(unresearched_companies),
            undecided_research_count=undecided_research_count,
        )

        current_situation = (
            f"{len(companies)} companies, {len(upcoming_events)} upcoming events, "
            f"{len(deadline_alerts)} deadline alerts within 7 days, {unread_notifications} unread notifications."
        )

        return AdvisorSummary(
            current_situation=current_situation,
            main_issue=main_issue,
            reason=reason,
            todays_mission=todays_mission,
            this_week=this_week,
            suggested_improvements=suggested_improvements,
            risk_monitor=risk_monitor,
            deadline_alerts=deadline_alerts,
            missing_portfolio=missing_portfolio,
            application_balance=balance,
        )

    def _deadline_alerts(
        self,
        *,
        companies: list[Company],
        events: list[Event],
        today: date,
        week_end: date,
    ) -> list[AdvisorDeadlineAlert]:
        alerts: list[AdvisorDeadlineAlert] = []
        for company in companies:
            if company.status not in ES_PENDING_STATUSES:
                continue
            if company.es_deadline and today <= company.es_deadline <= week_end:
                alerts.append(
                    AdvisorDeadlineAlert(
                        title=f"{company.name} ES deadline",
                        due_date=company.es_deadline.isoformat(),
                        days_left=(company.es_deadline - today).days,
                        source="company",
                    )
                )
        for event in events:
            if event.type == "deadline" and today <= event.start_date <= week_end:
                alerts.append(
                    AdvisorDeadlineAlert(
                        title=event.title,
                        due_date=event.start_date.isoformat(),
                        days_left=(event.start_date - today).days,
                        source="event",
                    )
                )
        return sorted(alerts, key=lambda alert: (alert.days_left, alert.title))

    def _application_balance(self, position_counts: dict[str, int]) -> AdvisorApplicationBalance:
        active_total = sum(position_counts[position] for position in ACTIVE_POSITIONS)
        ratios = {
            position: round((position_counts[position] / active_total) * 100, 1) if active_total else 0.0
            for position in ACTIVE_POSITIONS
        }
        recommendation = "Portfolio balance is currently acceptable."
        if active_total == 0:
            recommendation = "Add at least one Core company to start portfolio planning."
        elif ratios["Reach"] > 40:
            recommendation = "Reach is above 40%. Consider adding Core or Safe companies."
        elif ratios["Core"] < 40:
            recommendation = "Core companies are below the recommended center of the portfolio."
        elif ratios["Safe"] < 15:
            recommendation = "Safe companies are low. Add safety options if risk feels high."
        return AdvisorApplicationBalance(
            reach_ratio=ratios["Reach"],
            core_ratio=ratios["Core"],
            safe_ratio=ratios["Safe"],
            hold_count=position_counts["Hold"],
            recommendation=recommendation,
        )

    def _missing_portfolio(self, position_counts: dict[str, int]) -> list[str]:
        missing: list[str] = []
        if position_counts["Reach"] == 0:
            missing.append("Reach")
        if position_counts["Core"] == 0:
            missing.append("Core")
        if position_counts["Safe"] == 0:
            missing.append("Safe")
        active_total = sum(position_counts[position] for position in ACTIVE_POSITIONS)
        if active_total and (position_counts["Reach"] / active_total) > 0.4:
            missing.append("Core/Safe")
        return missing

    def _main_issue(
        self,
        *,
        spi_rejected: int,
        es_rejected: int,
        interview_count: int,
        deadline_count: int,
        missing_portfolio: list[str],
        offer_count: int,
        total_companies: int,
    ) -> tuple[str, str]:
        if deadline_count:
            return "Deadline", f"{deadline_count} deadline item(s) are within 7 days."
        if spi_rejected >= 3:
            return "SPI", f"SPI rejected count reached {spi_rejected}."
        if es_rejected >= 3:
            return "ES", f"ES rejected count reached {es_rejected}."
        if total_companies > 0 and interview_count == 0 and offer_count == 0:
            return "Interview", "There are no interview events yet."
        if missing_portfolio:
            return "Application Balance", f"Missing or weak portfolio area: {missing_portfolio[0]}."
        return "No Issue", "No urgent issue was detected. Keep reviewing the next action."

    def _todays_mission(
        self,
        *,
        main_issue: str,
        deadline_alerts: list[AdvisorDeadlineAlert],
        interview_events: list[Event],
        today: date,
    ) -> list[AdvisorAction]:
        actions: list[AdvisorAction] = []
        urgent_deadlines = [alert for alert in deadline_alerts if alert.days_left <= 1]
        if urgent_deadlines:
            actions.append(
                AdvisorAction(
                    id="deadline-today",
                    title="Finish the nearest deadline item",
                    reason=f"{urgent_deadlines[0].title} is due in {urgent_deadlines[0].days_left} day(s).",
                    priority="high",
                )
            )
        interviews_soon = [event for event in interview_events if 0 <= (event.start_date - today).days <= 1]
        if interviews_soon:
            actions.append(
                AdvisorAction(
                    id="interview-story",
                    title="Prepare one interview story set",
                    reason=f"{interviews_soon[0].title} is scheduled soon.",
                    priority="high",
                )
            )
        if main_issue == "SPI":
            actions.append(AdvisorAction(id="spi-practice", title="Run one SPI practice set", reason="SPI is the main issue.", priority="high"))
        elif main_issue == "ES":
            actions.append(AdvisorAction(id="es-rewrite", title="Rewrite one ES answer", reason="ES is the main issue.", priority="high"))
        if not actions:
            actions.append(AdvisorAction(id="daily-review", title="Choose one next action", reason="No urgent same-day risk was found.", priority="medium"))
        return actions[:3]

    def _this_week(
        self,
        *,
        main_issue: str,
        missing_portfolio: list[str],
        unread_notifications: int,
        accepted_research: int,
        upcoming_events: list[Event],
        unresearched_companies: list[Company],
        undecided_research_count: int,
    ) -> list[AdvisorAction]:
        actions: list[AdvisorAction] = []
        if unresearched_companies:
            actions.append(
                AdvisorAction(
                    id="generate-research",
                    title=f"Generate research for {unresearched_companies[0].name}",
                    reason="New companies become actionable after Company Notebook research is generated.",
                    priority="medium",
                )
            )
        elif undecided_research_count:
            actions.append(
                AdvisorAction(
                    id="review-research-decision",
                    title="Review pending Company Research",
                    reason=f"{undecided_research_count} research memo(s) are generated but not accepted or rejected yet.",
                    priority="medium",
                )
            )
        if missing_portfolio:
            actions.append(
                AdvisorAction(
                    id="portfolio-balance",
                    title=f"Improve {missing_portfolio[0]} portfolio coverage",
                    reason="Application balance affects risk distribution.",
                    priority="medium",
                )
            )
        if main_issue == "Interview":
            actions.append(
                AdvisorAction(
                    id="interview-opportunity",
                    title="Create more interview opportunities",
                    reason="No interview event has been registered yet.",
                    priority="medium",
                )
            )
        if len(upcoming_events) <= 1:
            actions.append(
                AdvisorAction(
                    id="weekly-schedule",
                    title="Add one concrete event for this week",
                    reason="Your weekly schedule has few actionable events.",
                    priority="medium",
                )
            )
        if unread_notifications:
            actions.append(
                AdvisorAction(
                    id="notification-review",
                    title="Review unread notifications",
                    reason=f"{unread_notifications} notification(s) are unread.",
                    priority="low",
                )
            )
        if accepted_research == 0:
            actions.append(
                AdvisorAction(
                    id="research-review",
                    title="Accept or edit one AI Research memo",
                    reason="Company Notebook becomes more useful after research is reviewed.",
                    priority="low",
                )
            )
        return actions[:4] or [AdvisorAction(id="maintain", title="Maintain current pace", reason="No major weekly gap was detected.", priority="low")]

    def _suggested_improvements(
        self,
        *,
        es_rejected: int,
        spi_rejected: int,
        interview_count: int,
        accepted_research: int,
        missing_portfolio: list[str],
        unresearched_count: int,
        undecided_research_count: int,
    ) -> list[AdvisorAction]:
        improvements: list[AdvisorAction] = []
        if unresearched_count:
            improvements.append(AdvisorAction(id="improve-research-generation", title="Generate Company Research for new companies", reason=f"{unresearched_count} company/companies do not have research yet.", priority="medium"))
        if undecided_research_count:
            improvements.append(AdvisorAction(id="improve-research-decision", title="Accept, edit, or reject generated research", reason="Research only affects strategy after the user reviews it.", priority="medium"))
        if spi_rejected:
            improvements.append(AdvisorAction(id="improve-spi", title="Strengthen SPI practice routine", reason=f"SPI rejected count: {spi_rejected}.", priority="high" if spi_rejected >= 3 else "medium"))
        if es_rejected:
            improvements.append(AdvisorAction(id="improve-es", title="Improve company-specific ES quality", reason=f"ES rejected count: {es_rejected}.", priority="high" if es_rejected >= 3 else "medium"))
        if interview_count == 0:
            improvements.append(AdvisorAction(id="improve-interview", title="Prepare interview entry stories", reason="Interview opportunities are not visible yet.", priority="medium"))
        if accepted_research == 0:
            improvements.append(AdvisorAction(id="improve-research", title="Review one Company Notebook research", reason="Accepted research helps clarify strategy context.", priority="low"))
        if missing_portfolio:
            improvements.append(AdvisorAction(id="improve-balance", title="Review portfolio balance", reason=f"Missing: {', '.join(missing_portfolio)}.", priority="medium"))
        return improvements[:5]
