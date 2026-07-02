from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.test_companies_events_dashboard import company_payload, create_company, event_payload


def task_payload(**overrides):
    payload = {
        "title": "Submit ES",
        "description": "Finish draft and submit",
        "due_date": date.today().isoformat(),
        "priority": "high",
        "status": "todo",
        "related_company_id": None,
        "related_event_id": None,
    }
    payload.update(overrides)
    return payload


def create_task(client: TestClient, headers: dict[str, str], **overrides):
    response = client.post("/tasks", headers=headers, json=task_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def test_task_crud_and_complete(client: TestClient, auth_headers: dict[str, str]):
    company = create_company(client, auth_headers, name="Sony")
    event = client.post(
        "/events",
        headers=auth_headers,
        json=event_payload(company_id=company["id"], title="Interview", type="interview"),
    ).json()

    created = create_task(
        client,
        auth_headers,
        related_company_id=company["id"],
        related_event_id=event["id"],
    )
    assert created["title"] == "Submit ES"
    assert created["company_name"] == "Sony"
    assert created["event_title"] == "Interview"

    listed = client.get("/tasks", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = client.put(
        f"/tasks/{created['id']}",
        headers=auth_headers,
        json={"status": "in_progress", "priority": "medium"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"

    completed = client.patch(f"/tasks/{created['id']}/complete", headers=auth_headers)
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"

    deleted = client.delete(f"/tasks/{created['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/tasks/{created['id']}", headers=auth_headers).status_code == 404


def test_task_rejects_other_users_related_records(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    other_company = create_company(client, second_user_headers, name="Other user company")
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json=task_payload(related_company_id=other_company["id"]),
    )
    assert response.status_code == 400


def test_dashboard_reflects_task_counts(client: TestClient, auth_headers: dict[str, str]):
    today = date.today()
    create_task(client, auth_headers, title="Today task", due_date=today.isoformat(), status="todo")
    create_task(client, auth_headers, title="Overdue task", due_date=(today - timedelta(days=1)).isoformat(), status="in_progress")
    create_task(client, auth_headers, title="Done task", due_date=today.isoformat(), status="completed")

    response = client.get("/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    kpis = response.json()["kpis"]
    assert kpis["incomplete_tasks"] == 2
    assert kpis["today_tasks"] == 1
    assert kpis["overdue_tasks"] == 1
    assert kpis["task_completion_rate"] == 33
