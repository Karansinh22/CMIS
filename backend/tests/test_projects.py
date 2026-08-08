"""
tests/test_projects.py — Unit & integration tests for Projects and multi-meeting synthesis.
"""

from fastapi.testclient import TestClient
from db.models import Project, ProjectSummary
from nlp.project_synthesizer import synthesize_project_context


def test_create_and_list_projects(client: TestClient, db):
    # 1. Create project via API
    res = client.post("/projects", json={
        "name": "Acme Android App Viva",
        "company": "Acme Corp",
        "category": "Viva / Defense",
        "description": "Multi-session context for Android App Viva"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Acme Android App Viva"
    assert data["company"] == "Acme Corp"
    project_id = data["id"]

    # 2. List projects
    res_list = client.get("/projects")
    assert res_list.status_code == 200
    projects = res_list.json()
    assert len(projects) >= 1
    assert any(p["id"] == project_id for p in projects)

    # 3. Get detail
    res_detail = client.get(f"/projects/{project_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["name"] == "Acme Android App Viva"
    assert "summary" in detail
    assert detail["summary"]["meeting_count"] == 0


def test_project_synthesis(db):
    # Create test project in DB
    p = Project(name="Engineering Sprint Workspace", company="Internal", category="Engineering")
    db.add(p)
    db.commit()
    db.refresh(p)

    # Run synthesis
    ps = synthesize_project_context(p.id, db)
    assert ps is not None
    assert ps.project_id == p.id
    assert "Engineering Sprint Workspace" in ps.overall_summary
