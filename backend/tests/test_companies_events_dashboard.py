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
    created = create_company(client, auth_headers)
    company_id = created["id"]

    listed = client.get("/companies", headers=auth_headers)
    assert listed.status_code == 200
    assert [company["id"] for company in listed.json()] == [company_id]

    updated = client.put(
        f"/companies/{company_id}",
        headers=auth_headers,
        json={"name": "Updated Corp", "status": "es_submitted"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Corp"
    assert updated.json()["status"] == "es_submitted"

    deleted = client.delete(f"/companies/{company_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/companies/{company_id}", headers=auth_headers).status_code == 404


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
    assert data["kpis"]["deadline_soon"] == 2
    assert data["company_status_counts"]["es_submitted"] == 1
    assert data["industry_counts"]["it"] == 1
    assert any(event["id"] == briefing["id"] for event in data["upcoming_events"])
    assert any(deadline_item["id"] == f"event-{deadline['id']}" for deadline_item in data["upcoming_deadlines"])


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
