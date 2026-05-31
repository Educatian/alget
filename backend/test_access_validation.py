from server import validate_access_passcode


def test_validate_access_passcode_requires_configuration_by_default(monkeypatch):
    monkeypatch.delenv("ALLOW_FALLBACK_ACCESS_CODES", raising=False)
    monkeypatch.delenv("ENGINEERING_ACCESS_CODE", raising=False)
    assert validate_access_passcode("engineering", "eng123") is False


def test_validate_access_passcode_uses_opt_in_fallback_codes(monkeypatch):
    monkeypatch.setenv("ALLOW_FALLBACK_ACCESS_CODES", "true")
    assert validate_access_passcode("engineering", "eng123") is True
    assert validate_access_passcode("education", "edu123") is True
    assert validate_access_passcode("researcher", "immersivebama") is True
    assert validate_access_passcode("engineering", "wrong") is False


def test_validate_access_passcode_prefers_env_codes(monkeypatch):
    monkeypatch.delenv("ALLOW_FALLBACK_ACCESS_CODES", raising=False)
    monkeypatch.setenv("ENGINEERING_ACCESS_CODE", "CourseSecret")
    assert validate_access_passcode("engineering", "coursesecret") is True
    assert validate_access_passcode("engineering", "eng123") is False
