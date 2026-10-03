from server import validate_access_passcode


def test_no_built_in_codes(monkeypatch):
    for key in ("ENGINEERING_ACCESS_CODE", "EDUCATION_ACCESS_CODE", "RESEARCHER_ACCESS_CODE"):
        monkeypatch.delenv(key, raising=False)
    assert validate_access_passcode("engineering", "eng123") is False
    assert validate_access_passcode("education", "edu123") is False
    assert validate_access_passcode("engineering", "") is False


def test_pathway_codes_come_from_secrets(monkeypatch):
    monkeypatch.setenv("ENGINEERING_ACCESS_CODE", "secret-eng")
    assert validate_access_passcode("engineering", " secret-eng ") is True
    assert validate_access_passcode("engineering", "wrong") is False


def test_researcher_scope_is_always_refused(monkeypatch):
    monkeypatch.setenv("RESEARCHER_ACCESS_CODE", "anything")
    assert validate_access_passcode("researcher", "anything") is False
