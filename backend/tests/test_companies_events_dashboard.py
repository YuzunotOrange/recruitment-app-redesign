from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient


def company_payload(**overrides):
    payload = {
        "name": "Sample Corp",
        "industry": "it",
        "priority": "A",
        "importance": 4,
        "status": "planned",
        "es_deadline": None,
        "note": "memo",
    }
    payload.update(overrides)
    return payload


def event_payload(**overrides):
    future = datetime.now(UTC).date() + timedelta(days=3)
    payload = {
        "company_id": None,
        "title": "Briefing",
        "start_date": future.isoformat(),
        "end_date": future.isoformat(),
        "start_time": "10:00",
        "end_time": None,
        "type": "briefing",
        "note": "event memo",
    }
    payload.update(overrides)
    return payload


def create_company(client: TestClient, headers: dict[str, str], **overrides) -> dict:
    response = client.post("/companies", headers=headers, json=company_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def create_event(client: TestClient, headers: dict[str, str], **overrides) -> dict:
    response = client.post("/events", headers=headers, json=event_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def test_company_crud(client: TestClient, auth_headers: dict[str, str]):
    created = create_company(
        client,
        auth_headers,
        strategy_rank="S",
        difficulty_level=5,
        fit_score=72,
        success_probability=64,
        selection_risk="Interview",
        recommended_action="Prepare interview stories.",
        strategy_reason="Strong fit but difficult process.",
        user_strategy_note="Ask alumni about interview style.",
    )
    company_id = created["id"]
    assert created["strategy_rank"] == "S"
    assert created["difficulty_level"] == 5
    assert created["fit_score"] == 72
    assert created["success_probability"] == 64
    assert created["selection_risk"] == "Interview"
    assert created["recommended_action"] == "Prepare interview stories."
    assert created["strategy_reason"] == "Strong fit but difficult process."
    assert created["user_strategy_note"] == "Ask alumni about interview style."

    listed = client.get("/companies", headers=auth_headers)
    assert listed.status_code == 200
    assert [company["id"] for company in listed.json()] == [company_id]

    updated = client.put(
        f"/companies/{company_id}",
        headers=auth_headers,
        json={"name": "Updated Corp", "status": "es_submitted", "fit_score": 80, "user_strategy_note": "Updated memo."},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Corp"
    assert updated.json()["status"] == "es_submitted"
    assert updated.json()["fit_score"] == 80
    assert updated.json()["user_strategy_note"] == "Updated memo."

    deleted = client.delete(f"/companies/{company_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/companies/{company_id}", headers=auth_headers).status_code == 404


def test_company_research_generate_and_accept_updates_strategy(client: TestClient, auth_headers: dict[str, str]):
    company = create_company(client, auth_headers, name="Research Corp", industry="it", priority="A")

    empty = client.get(f"/companies/{company['id']}/research", headers=auth_headers)
    assert empty.status_code == 200
    assert empty.json() is None

    generated = client.post(f"/companies/{company['id']}/research/generate", headers=auth_headers)
    assert generated.status_code == 201
    research = generated.json()
    assert research["company_id"] == company["id"]
    assert research["provider"] == "mock"
    assert research["global"] >= 1
    assert research["accepted"] is False
    assert len(research["sources"]) == 2
    assert "final application decision should be made by the user" in research["research_summary"]

    accepted = client.post(
        f"/companies/{company['id']}/research/decision",
        headers=auth_headers,
        json={
            "decision": "accept",
            "research_summary": "Edited summary before accepting.",
            "ai_strategy_position": "Core",
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["accepted"] is True
    assert accepted.json()["research_summary"] == "Edited summary before accepting."

    updated_company = client.get(f"/companies/{company['id']}", headers=auth_headers)
    assert updated_company.status_code == 200
    assert updated_company.json()["strategy_reason"] == "Edited summary before accepting."
    assert "[Strategy Position]\nCore" in updated_company.json()["user_strategy_note"]


def test_company_research_reject_does_not_update_company(client: TestClient, auth_headers: dict[str, str]):
    company = create_company(client, auth_headers, name="Reject Corp", strategy_reason="Keep existing")
    generated = client.post(f"/companies/{company['id']}/research/generate", headers=auth_headers)
    assert generated.status_code == 201

    rejected = client.post(
        f"/companies/{company['id']}/research/decision",
        headers=auth_headers,
        json={"decision": "reject"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["accepted"] is False

    unchanged = client.get(f"/companies/{company['id']}", headers=auth_headers)
    assert unchanged.status_code == 200
    assert unchanged.json()["strategy_reason"] == "Keep existing"


def test_company_notebook_fields_can_be_saved(client: TestClient, auth_headers: dict[str, str]):
    company = create_company(client, auth_headers, name="Notebook Corp")

    updated = client.put(
        f"/companies/{company['id']}",
        headers=auth_headers,
        json={
            "es_motivation_draft": "I want to connect my project experience to this company.",
            "es_research_connection": "Their DX work matches my interests.",
            "es_project_connection": "CareerTrack can be used as a concrete story.",
            "es_appeal_points": "Strong customer-facing product culture.",
            "es_missing_information": "Need to confirm team assignment.",
            "interview_expected_questions": "Why this company?",
            "interview_stories": "Talk about web app development.",
            "interview_reverse_questions": "How are junior engineers supported?",
            "interview_reflection": "Practice concise answers.",
            "personal_notes": "Check recent IR before submitting ES.",
        },
    )

    assert updated.status_code == 200
    data = updated.json()
    assert data["es_motivation_draft"] == "I want to connect my project experience to this company."
    assert data["interview_expected_questions"] == "Why this company?"
    assert data["personal_notes"] == "Check recent IR before submitting ES."

    fetched = client.get(f"/companies/{company['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["es_project_connection"] == "CareerTrack can be used as a concrete story."
    assert fetched.json()["interview_reverse_questions"] == "How are junior engineers supported?"


def test_company_research_is_user_scoped(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    other_company = create_company(client, second_user_headers, name="Other Research Corp")

    assert client.get(f"/companies/{other_company['id']}/research", headers=auth_headers).status_code == 404
    assert client.post(f"/companies/{other_company['id']}/research/generate", headers=auth_headers).status_code == 404


def test_strategy_summary_and_recalculate(client: TestClient, auth_headers: dict[str, str]):
    create_company(client, auth_headers, name="SPI Corp", status="spi_rejected", difficulty_level=4, fit_score=55)
    create_company(client, auth_headers, name="ES Corp", status="es_rejected", difficulty_level=3, fit_score=70)
    create_company(client, auth_headers, name="Interview Corp", status="interview", difficulty_level=2, fit_score=80)
    create_company(client, auth_headers, name="Offer Corp", status="offer", difficulty_level=5, fit_score=90)

    recalculated = client.post("/strategy/recalculate", headers=auth_headers)
    assert recalculated.status_code == 200
    data = recalculated.json()
    assert data["metrics"]["spi_rejected"] == 1
    assert data["metrics"]["es_rejected"] == 1
    assert data["metrics"]["interviews"] == 1
    assert data["metrics"]["offers"] == 1
    assert data["counts"]["S"] >= 1
    assert any(action["action"] == "Add A/B rank companies to increase interview opportunities." for action in data["recommended_actions"])
    assert any(company["strategy_reason"] for bucket in data["buckets"].values() for company in bucket["companies"])

    summary = client.get("/strategy", headers=auth_headers)
    assert summary.status_code == 200
    assert summary.json()["metrics"]["total_companies"] == 4


def test_event_crud_and_authenticated_owner(client: TestClient, auth_headers: dict[str, str]):
    company = create_company(client, auth_headers)
    created = create_event(client, auth_headers, company_id=company["id"])
    event_id = created["id"]

    assert created["user_id"] == company["user_id"]
    assert created["company_name"] == company["name"]

    listed = client.get("/events", headers=auth_headers)
    assert listed.status_code == 200
    assert [event["id"] for event in listed.json()] == [event_id]

    updated = client.put(
        f"/events/{event_id}",
        headers=auth_headers,
        json={"title": "Updated Briefing", "type": "interview"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated Briefing"
    assert updated.json()["type"] == "interview"
    assert updated.json()["candidate_dates"] == []

    deleted = client.delete(f"/events/{event_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/events/{event_id}", headers=auth_headers).status_code == 404


def test_user_data_isolation_for_companies_events_and_dashboard(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    user_b_company = create_company(client, second_user_headers, name="User B Corp", status="offer")
    user_b_event = create_event(client, second_user_headers, title="User B Event", company_id=user_b_company["id"])

    assert client.get(f"/companies/{user_b_company['id']}", headers=auth_headers).status_code == 404
    assert client.get(f"/events/{user_b_event['id']}", headers=auth_headers).status_code == 404

    companies = client.get("/companies", headers=auth_headers)
    events = client.get("/events", headers=auth_headers)
    dashboard = client.get("/dashboard/summary", headers=auth_headers)

    assert companies.status_code == 200
    assert events.status_code == 200
    assert dashboard.status_code == 200
    assert companies.json() == []
    assert events.json() == []
    assert dashboard.json()["kpis"]["total_companies"] == 0
    assert dashboard.json()["upcoming_events"] == []


def test_empty_dashboard_returns_zero_and_empty_values(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/dashboard/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["kpis"]["total_companies"] == 0
    assert data["kpis"]["deadline_soon"] == 0
    assert data["company_status_counts"]["planned"] == 0
    assert data["industry_counts"]["it"] == 0
    assert data["upcoming_events"] == []
    assert data["upcoming_deadlines"] == []


def test_empty_decision_summary_is_safe(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/decision/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["main_issue"] in ["Application Balance", "No Issue"]
    assert data["today_tasks"]
    assert data["week_tasks"]
    assert data["application_balance"]["reach_count"] == 0
    assert data["risk_monitor"]["deadline"] == "low"


def test_decision_summary_prioritizes_spi_rejections(client: TestClient, auth_headers: dict[str, str]):
    create_company(client, auth_headers, name="SPI A", status="spi_rejected")
    create_company(client, auth_headers, name="SPI B", status="spi_rejected")
    create_company(client, auth_headers, name="ES A", status="es_rejected")

    response = client.get("/decision/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["main_issue"] == "SPI"
    assert data["risk_monitor"]["spi"] == "high"
    assert any("SPI" in task["title"] or "SPI" in task["reason"] for task in data["today_tasks"])


def test_decision_summary_detects_deadline_priority(client: TestClient, auth_headers: dict[str, str]):
    today = datetime.now(UTC).date()
    create_company(client, auth_headers, name="Deadline A", es_deadline=today.isoformat())
    create_company(client, auth_headers, name="Deadline B", es_deadline=(today + timedelta(days=2)).isoformat())

    response = client.get("/decision/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["main_issue"] == "Deadline"
    assert data["risk_monitor"]["deadline"] == "medium"
    assert any("deadline" in task["title"].lower() for task in data["today_tasks"])


def test_empty_advisor_summary_is_safe(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/advisor/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["current_situation"]
    assert data["todays_mission"]
    assert data["this_week"]
    assert data["risk_monitor"]["deadline"] == "low"
    assert "decides" in data["system_note"]


def test_advisor_summary_prioritizes_spi_and_improvements(client: TestClient, auth_headers: dict[str, str]):
    create_company(client, auth_headers, name="SPI A", status="spi_rejected")
    create_company(client, auth_headers, name="SPI B", status="spi_rejected")
    create_company(client, auth_headers, name="SPI C", status="spi_rejected")

    response = client.get("/advisor/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["main_issue"] == "SPI"
    assert data["risk_monitor"]["spi"] == "high"
    assert any("SPI" in action["title"] or "SPI" in action["reason"] for action in data["todays_mission"])
    assert any(action["id"] == "improve-spi" for action in data["suggested_improvements"])


def test_advisor_summary_detects_deadline_alerts(client: TestClient, auth_headers: dict[str, str]):
    today = datetime.now(UTC).date()
    create_company(client, auth_headers, name="Advisor Deadline", es_deadline=(today + timedelta(days=1)).isoformat())

    response = client.get("/advisor/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["main_issue"] == "Deadline"
    assert data["deadline_alerts"][0]["title"] == "Advisor Deadline ES deadline"
    assert data["deadline_alerts"][0]["days_left"] == 1


def test_advisor_guides_company_research_workflow(client: TestClient, auth_headers: dict[str, str]):
    company = create_company(client, auth_headers, name="Workflow Corp", industry="it")

    initial = client.get("/advisor/summary", headers=auth_headers)
    assert initial.status_code == 200
    initial_data = initial.json()
    assert any(action["id"] == "generate-research" for action in initial_data["this_week"])

    generated = client.post(f"/companies/{company['id']}/research/generate", headers=auth_headers)
    assert generated.status_code == 201

    after_generation = client.get("/advisor/summary", headers=auth_headers)
    assert after_generation.status_code == 200
    after_data = after_generation.json()
    assert any(action["id"] == "review-research-decision" for action in after_data["this_week"])


def test_dashboard_summary_reflects_companies_events_and_deadlines(
    client: TestClient,
    auth_headers: dict[str, str],
):
    today = datetime.now(UTC).date()
    company = create_company(
        client,
        auth_headers,
        name="Dashboard Corp",
        status="es_submitted",
        es_deadline=(today + timedelta(days=2)).isoformat(),
    )
    briefing = create_event(
        client,
        auth_headers,
        title="Company Briefing",
        company_id=company["id"],
        start_date=(today + timedelta(days=3)).isoformat(),
        end_date=(today + timedelta(days=3)).isoformat(),
        type="briefing",
    )
    deadline = create_event(
        client,
        auth_headers,
        title="Web Test Deadline",
        company_id=company["id"],
        start_date=(today + timedelta(days=4)).isoformat(),
        end_date=(today + timedelta(days=4)).isoformat(),
        type="deadline",
    )

    response = client.get("/dashboard/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["kpis"]["total_companies"] == 1
    assert data["kpis"]["es_in_review"] == 1
    # The ES was already submitted, so only the event deadline counts toward deadline_soon.
    assert data["kpis"]["deadline_soon"] == 1
    assert data["company_status_counts"]["es_submitted"] == 1
    assert data["industry_counts"]["it"] == 1
    assert any(event["id"] == briefing["id"] for event in data["upcoming_events"])
    assert any(deadline_item["id"] == f"event-{deadline['id']}" for deadline_item in data["upcoming_deadlines"])
    assert all(not deadline_item["id"].startswith("company-") for deadline_item in data["upcoming_deadlines"])


def test_dashboard_counts_es_deadline_only_before_submission(
    client: TestClient,
    auth_headers: dict[str, str],
):
    today = datetime.now(UTC).date()
    deadline = (today + timedelta(days=2)).isoformat()
    create_company(client, auth_headers, name="Pending Corp", status="planned", es_deadline=deadline)
    create_company(client, auth_headers, name="Submitted Corp", status="es_submitted", es_deadline=deadline)

    response = client.get("/dashboard/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["kpis"]["deadline_soon"] == 1
    company_deadlines = [item for item in data["upcoming_deadlines"] if item["id"].startswith("company-")]
    assert len(company_deadlines) == 1
    assert company_deadlines[0]["company_name"] == "Pending Corp"


def test_event_with_end_time_displays_time_range_in_dashboard(client: TestClient, auth_headers: dict[str, str]):
    today = datetime.now(UTC).date()
    event = create_event(
        client,
        auth_headers,
        title="Timed Interview",
        type="interview",
        start_date=(today + timedelta(days=3)).isoformat(),
        end_date=(today + timedelta(days=3)).isoformat(),
        start_time="09:30",
        end_time="12:00",
    )

    assert event["start_time"] == "09:30:00"
    assert event["end_time"] == "12:00:00"

    summary = client.get("/dashboard/summary", headers=auth_headers)
    assert summary.status_code == 200
    assert any(item["time"] == "09:30 - 12:00" for item in summary.json()["upcoming_events"])


def test_event_with_one_candidate_uses_candidate_as_representative(client: TestClient, auth_headers: dict[str, str]):
    today = datetime.now(UTC).date()
    candidate_day = today + timedelta(days=5)
    event = create_event(
        client,
        auth_headers,
        title="Intern Candidate",
        type="intern",
        candidate_dates=[
            {
                "start_date": candidate_day.isoformat(),
                "end_date": candidate_day.isoformat(),
                "start_time": "13:00",
                "end_time": "16:00",
                "note": "first slot",
                "is_selected": False,
            }
        ],
    )

    assert event["start_date"] == candidate_day.isoformat()
    assert event["end_date"] == candidate_day.isoformat()
    assert event["start_time"] == "13:00:00"
    assert event["end_time"] == "16:00:00"
    assert len(event["candidate_dates"]) == 1


def test_event_with_multiple_candidates_and_selected_candidate(client: TestClient, auth_headers: dict[str, str]):
    today = datetime.now(UTC).date()
    first = today + timedelta(days=4)
    selected = today + timedelta(days=8)
    event = create_event(
        client,
        auth_headers,
        title="Intern Options",
        type="intern",
        candidate_dates=[
            {
                "start_date": first.isoformat(),
                "end_date": first.isoformat(),
                "start_time": "09:30",
                "end_time": "12:00",
                "note": "candidate 1",
                "is_selected": False,
            },
            {
                "start_date": selected.isoformat(),
                "end_date": selected.isoformat(),
                "start_time": None,
                "end_time": None,
                "note": "selected all day",
                "is_selected": True,
            },
        ],
    )

    assert event["start_date"] == selected.isoformat()
    assert event["start_time"] is None
    assert len(event["candidate_dates"]) == 2
    assert sum(1 for candidate in event["candidate_dates"] if candidate["is_selected"]) == 1


def test_event_rejects_multiple_selected_candidates(client: TestClient, auth_headers: dict[str, str]):
    today = datetime.now(UTC).date()
    response = client.post(
        "/events",
        headers=auth_headers,
        json=event_payload(
            candidate_dates=[
                {
                    "start_date": (today + timedelta(days=4)).isoformat(),
                    "end_date": (today + timedelta(days=4)).isoformat(),
                    "is_selected": True,
                },
                {
                    "start_date": (today + timedelta(days=5)).isoformat(),
                    "end_date": (today + timedelta(days=5)).isoformat(),
                    "is_selected": True,
                },
            ]
        ),
    )

    assert response.status_code == 422
