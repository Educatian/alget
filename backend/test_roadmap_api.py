import sys

from fastapi.testclient import TestClient

sys.path.insert(0, "backend")
import server  # noqa: E402


def test_manifest_exposes_all_roadmap_horizons():
    response = TestClient(server.app).get("/api/roadmap/manifest")
    assert response.status_code == 200
    payload = response.json()
    assert payload["roadmap_contract"] == "roadmap-runtime-v1"
    assert set(payload["horizons"]) == {"0-12_months", "12-24_months", "24-36_months"}


def test_openapi_contains_the_governance_surface():
    paths = server.app.openapi()["paths"]
    for path in (
        "/api/roadmap/runtime-package",
        "/api/roadmap/decision-ledger",
        "/api/roadmap/interoperability/caliper",
        "/api/roadmap/interoperability/oneroster",
        "/api/roadmap/interoperability/case",
        "/api/roadmap/model-registry",
        "/api/roadmap/privacy/export",
        "/api/roadmap/privacy/delete",
        "/api/roadmap/incidents",
        "/api/roadmap/evaluation-manifest",
    ):
        assert path in paths


def test_runtime_package_endpoint_returns_validation_contract():
    server.app.dependency_overrides[server.require_faculty_access] = lambda: {"role": "instructor", "subject": "u1"}
    try:
        response = TestClient(server.app).post("/api/roadmap/runtime-package", json={
            "course_id": "ail-606",
            "source_text": "Evidence evaluation compares a claim with a source.",
            "source": {"title": "Source"},
            "sections": [{"id": "01/01", "title": "Evidence", "reading": {"content": "Compare the claim."}, "references": [{"url": "https://example.edu/source"}]}],
        })
        assert response.status_code == 200
        payload = response.json()
        assert payload["package"]["release"]["status"] == "shadow_draft"
        assert payload["validation"]["valid"] is True
    finally:
        server.app.dependency_overrides.pop(server.require_faculty_access, None)


def test_privacy_delete_requires_explicit_confirmation():
    server.app.dependency_overrides[server.require_faculty_access] = lambda: {"role": "instructor", "subject": "u1"}
    try:
        response = TestClient(server.app).post("/api/roadmap/privacy/delete", json={"subject_id": "u1", "records": [{"id": "a", "user_id": "u1"}]})
        assert response.status_code == 200
        assert response.json()["requires_explicit_confirmation"] is True
    finally:
        server.app.dependency_overrides.pop(server.require_faculty_access, None)
