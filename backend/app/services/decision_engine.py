from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.models.company import Company
from app.models.company_research import CompanyResearch
from app.models.event import Event
from app.models.notification import Notification
from app.schemas.decision import BalanceSnapshot, DecisionSummary, DecisionTask, RiskMonitor, SuggestedCompanyGap


STRATEGY_POSITIONS = ("Reach", "Core", "Safe", "Hold")
ACTIVE_POSITIONS = ("Reach", "Core", "Safe")
IDEAL_RATIOS = {"Reach": 30, "Core": 50, "Safe": 20}


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


def _risk_level(count: int, medium_at: int = 1, high_at: int = 2) -> str:
    if count >= high_at:
        return "high"
    if count >= medium_at:
        return "medium"
    return "low"


def _deadline_days(company: Company, today: date) -> int | None:
    if not company.es_deadline:
        return None
    return (company.es_deadline - today).days


def _event_days(event: Event, today: date) -> int:
    return (event.start_date - today).days


class DecisionEngine:
    """Rule-based decision support. It prioritizes actions but never decides whether to apply."""

    def build_summary(
        self,
        *,
        companies: list[Company],
        events: list[Event],
        notifications: list[Notification],
        research_entries: list[CompanyResearch],
    ) -> DecisionSummary:
        today = datetime.now(UTC).date()
        week_end = today + timedelta(days=7)

        es_rejected = sum(1 for company in companies if company.status == "es_rejected")
        spi_rejected = sum(1 for company in companies if company.status == "spi_rejected")
        interview_events = [event for event in events if event.type == "interview"]
        upcoming_events = [event for event in events if event.start_date >= today]
        soon_deadline_companies = [
            company
            for company in companies
            if company.es_deadline is not None and today <= company.es_deadline <= week_end
        ]
        soon_deadline_events = [
            event for event in upcoming_events if event.type == "deadline" and today <= event.start_date <= week_end
        ]
        unread_notifications = sum(1 for notification in notifications if not notification.is_read)
        accepted_research = sum(1 for research in research_entries if research.accepted)

        position_counts = {position: 0 for position in STRATEGY_POSITIONS}
        for company in companies:
            position_counts[_strategy_position(company)] += 1

        active_total = sum(position_counts[position] for position in ACTIVE_POSITIONS)
        ratios = {
            position: round((position_counts[position] / active_total) * 100, 1) if active_total else 0.0
            for position in ACTIVE_POSITIONS
        }
        balance = BalanceSnapshot(
            reach_count=position_counts["Reach"],
            core_count=position_counts["Core"],
            safe_count=position_counts["Safe"],
            hold_count=position_counts["Hold"],
            reach_ratio=ratios["Reach"],
            core_ratio=ratios["Core"],
            safe_ratio=ratios["Safe"],
        )
        suggested_companies = self._suggest_company_gaps(position_counts, active_total)

        deadline_risk_count = len(soon_deadline_companies) + len(soon_deadline_events)
        risk_monitor = RiskMonitor(
            es=_risk_level(es_rejected),
            spi=_risk_level(spi_rejected),
            interview="medium" if len(interview_events) < 3 and companies else "low",
            deadline=_risk_level(deadline_risk_count, medium_at=1, high_at=3),
        )

        main_issue, reason = self._main_issue(
            spi_rejected=spi_rejected,
            es_rejected=es_rejected,
            interview_count=len(interview_events),
            deadline_count=deadline_risk_count,
            suggested_companies=suggested_companies,
            offer_count=sum(1 for company in companies if company.status == "offer"),
            total_companies=len(companies),
        )

        today_tasks = self._today_tasks(
            main_issue=main_issue,
            soon_deadline_companies=soon_deadline_companies,
            soon_deadline_events=soon_deadline_events,
            interview_events=interview_events,
            today=today,
        )
        week_tasks = self._week_tasks(
            main_issue=main_issue,
            suggested_companies=suggested_companies,
            unread_notifications=unread_notifications,
            accepted_research=accepted_research,
            upcoming_events=upcoming_events,
            today=today,
        )

        current_situation = (
            f"{len(companies)} companies, {len(upcoming_events)} upcoming events, "
            f"{deadline_risk_count} deadlines within 7 days."
        )
        system_analysis = (
            "Rule-based analysis from companies, strategy positions, events, notifications, and accepted AI research. "
            "It ranks priorities only; the user makes the final application decision."
        )

        return DecisionSummary(
            main_issue=main_issue,
            reason=reason,
            today_tasks=today_tasks,
            week_tasks=week_tasks,
            suggested_companies=suggested_companies,
            risk_monitor=risk_monitor,
            application_balance=balance,
            current_situation=current_situation,
            system_analysis=system_analysis,
        )

    def _suggest_company_gaps(self, position_counts: dict[str, int], active_total: int) -> list[SuggestedCompanyGap]:
        if active_total == 0:
            return [
                SuggestedCompanyGap(
                    position="Core",
                    shortage=1,
                    reason="Classify at least one company as Core to start portfolio balance.",
                )
            ]

        gaps: list[SuggestedCompanyGap] = []
        for position in ACTIVE_POSITIONS:
            ideal_count = max(1, round(active_total * IDEAL_RATIOS[position] / 100))
            shortage = max(0, ideal_count - position_counts[position])
            if shortage:
                gaps.append(
                    SuggestedCompanyGap(
                        position=position,
                        shortage=shortage,
                        reason=f"{position} is below the ideal {IDEAL_RATIOS[position]}% balance.",
                    )
                )
        return sorted(gaps, key=lambda item: item.shortage, reverse=True)

    def _main_issue(
        self,
        *,
        spi_rejected: int,
        es_rejected: int,
        interview_count: int,
        deadline_count: int,
        suggested_companies: list[SuggestedCompanyGap],
        offer_count: int,
        total_companies: int,
    ) -> tuple[str, str]:
        if deadline_count >= 2:
            return "Deadline", f"{deadline_count} deadlines are due within 7 days."
        if spi_rejected >= es_rejected and spi_rejected > 0:
            return "SPI", f"SPI rejected count is currently the largest rejection signal ({spi_rejected})."
        if es_rejected > spi_rejected and es_rejected > 0:
            return "ES", f"ES rejected count is currently the largest rejection signal ({es_rejected})."
        if total_companies > 0 and interview_count < 3 and offer_count == 0:
            return "Interview", f"Interview opportunities are still low ({interview_count})."
        if suggested_companies:
            target = suggested_companies[0]
            return "Application Balance", f"{target.position} companies are below the ideal portfolio balance."
        return "No Issue", "No urgent issue was detected from the current data."

    def _today_tasks(
        self,
        *,
        main_issue: str,
        soon_deadline_companies: list[Company],
        soon_deadline_events: list[Event],
        interview_events: list[Event],
        today: date,
    ) -> list[DecisionTask]:
        tasks: list[DecisionTask] = []
        due_today = [company for company in soon_deadline_companies if _deadline_days(company, today) == 0]
        due_tomorrow = [company for company in soon_deadline_companies if _deadline_days(company, today) == 1]
        event_deadlines_today = [event for event in soon_deadline_events if _event_days(event, today) == 0]
        interviews_soon = [event for event in interview_events if 0 <= _event_days(event, today) <= 1]

        if due_today or event_deadlines_today:
            tasks.append(
                DecisionTask(
                    title="Finish today's deadline work",
                    reason="At least one ES or deadline event is due today.",
                    priority="high",
                )
            )
        elif due_tomorrow:
            tasks.append(
                DecisionTask(
                    title="Prepare tomorrow's ES deadline",
                    reason=f"{due_tomorrow[0].name} is due tomorrow.",
                    priority="high",
                )
            )

        if interviews_soon:
            tasks.append(
                DecisionTask(
                    title="Prepare the next interview story set",
                    reason=f"{interviews_soon[0].title} is scheduled soon.",
                    priority="high",
                )
            )

        if main_issue == "SPI":
            tasks.append(DecisionTask(title="Run one SPI practice set", reason="SPI is the current main issue.", priority="high"))
        elif main_issue == "ES":
            tasks.append(DecisionTask(title="Rewrite one company-specific ES answer", reason="ES is the current main issue.", priority="high"))

        if not tasks:
            tasks.append(
                DecisionTask(
                    title="Choose one next action and schedule it",
                    reason="No urgent same-day risk was detected.",
                    priority="medium",
                )
            )
        return tasks[:3]

    def _week_tasks(
        self,
        *,
        main_issue: str,
        suggested_companies: list[SuggestedCompanyGap],
        unread_notifications: int,
        accepted_research: int,
        upcoming_events: list[Event],
        today: date,
    ) -> list[DecisionTask]:
        tasks: list[DecisionTask] = []
        if suggested_companies:
            target = suggested_companies[0]
            tasks.append(
                DecisionTask(
                    title=f"Add or reclassify {target.position} companies",
                    reason=target.reason,
                    priority="medium",
                )
            )

        if main_issue == "Interview":
            tasks.append(
                DecisionTask(
                    title="Increase interview opportunities",
                    reason="Interview count is low compared with the active application pipeline.",
                    priority="medium",
                )
            )

        week_events = [event for event in upcoming_events if 0 <= _event_days(event, today) <= 7]
        if len(week_events) <= 1:
            tasks.append(
                DecisionTask(
                    title="Add one concrete event for this week",
                    reason="The current weekly schedule has few actionable events.",
                    priority="medium",
                )
            )

        if unread_notifications:
            tasks.append(
                DecisionTask(
                    title="Review unread notifications",
                    reason=f"{unread_notifications} notifications are unread.",
                    priority="low",
                )
            )

        if accepted_research == 0:
            tasks.append(
                DecisionTask(
                    title="Accept or edit one AI Research memo",
                    reason="Accepted AI Research can clarify Strategy Memo context, but the final decision remains yours.",
                    priority="low",
                )
            )

        if not tasks:
            tasks.append(
                DecisionTask(
                    title="Maintain current selection pace",
                    reason="No major weekly gap was detected.",
                    priority="low",
                )
            )
        return tasks[:4]
