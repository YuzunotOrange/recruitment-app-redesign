from fastapi.testclient import TestClient


def create_company(client: TestClient, headers: dict[str, str], **overrides) -> dict:
    payload = {
        "name": "Fit Corp",
        "industry": "it",
        "priority": "A",
        "importance": 4,
        "status": "planned",
        "es_deadline": "2026-07-30",
        "note": "DX product company",
    }
    payload.update(overrides)
    response = client.post("/companies", headers=headers, json=payload)
    assert response.status_code == 201
    return response.json()


def test_get_profile_creates_empty_profile(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/profile", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["education"] is None
    assert data["skills"] == []
    assert data["programming_languages"] == []
    assert data["projects"] == []


def test_update_profile_persists_json_arrays(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "education": "Shibaura Institute of Technology",
        "major": "Information Science",
        "research_theme": "AI-assisted job hunting",
        "research_summary": "Decision support for recruitment workflows.",
        "skills": ["frontend", "backend", "data modeling"],
        "programming_languages": ["TypeScript", "Python"],
        "frameworks": ["Next.js", "FastAPI"],
        "projects": ["CareerTrack", "Portfolio app"],
        "internship_experience": "Web development internship",
        "qualifications": "Basic Information Technology Engineer",
        "certifications": "TOEIC",
        "interests": "AI, DX, product development",
        "preferred_industries": "IT, consulting",
        "preferred_jobs": "Software engineer, DX consultant",
        "preferred_locations": "Tokyo, remote",
        "global_interest": "Interested in global projects",
        "career_goal": "Build decision support products.",
        "self_strengths": "Fast implementation and user empathy",
        "self_weaknesses": "Needs more structured interview practice",
    }

    updated = client.put("/profile", headers=auth_headers, json=payload)
    assert updated.status_code == 200
    data = updated.json()
    assert data["education"] == payload["education"]
    assert data["skills"] == ["frontend", "backend", "data modeling"]
    assert data["programming_languages"] == ["TypeScript", "Python"]
    assert data["frameworks"] == ["Next.js", "FastAPI"]
    assert data["projects"] == ["CareerTrack", "Portfolio app"]

    fetched = client.get("/profile", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["career_goal"] == "Build decision support products."
    assert fetched.json()["self_strengths"] == "Fast implementation and user empathy"


def test_profile_is_user_scoped(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    response = client.put(
        "/profile",
        headers=auth_headers,
        json={"education": "User A school", "skills": ["A skill"]},
    )
    assert response.status_code == 200

    other = client.get("/profile", headers=second_user_headers)
    assert other.status_code == 200
    assert other.json()["education"] is None
    assert other.json()["skills"] == []


def test_company_fit_analysis_uses_profile_and_research(client: TestClient, auth_headers: dict[str, str]):
    profile = client.put(
        "/profile",
        headers=auth_headers,
        json={
            "research_theme": "AI data analysis for decision support",
            "skills": ["backend", "frontend"],
            "programming_languages": ["Python", "TypeScript"],
            "frameworks": ["FastAPI", "React"],
            "projects": ["CareerTrack web app with API and dashboard"],
            "preferred_industries": "IT, consulting",
            "preferred_jobs": "Software engineer, DX consultant",
            "global_interest": "Interested in global projects",
            "career_goal": "Build AI and DX decision support products.",
        },
    )
    assert profile.status_code == 200
    company = create_company(client, auth_headers, name="DX Fit Corp", industry="it", difficulty_level=4)
    generated = client.post(f"/companies/{company['id']}/research/generate", headers=auth_headers)
    assert generated.status_code == 201

    response = client.get(f"/companies/{company['id']}/fit", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert 0 <= data["overall_fit_score"] <= 100
    assert data["skill_match"]["score"] >= 50
    assert data["research_match"]["score"] >= 50
    assert "CareerTrack System Analysis" in data["system_note"]
    assert data["risk_score"]["reason"]


def test_company_fit_analysis_is_user_scoped(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    other_company = create_company(client, second_user_headers, name="Other User Fit Corp")

    response = client.get(f"/companies/{other_company['id']}/fit", headers=auth_headers)

    assert response.status_code == 404
