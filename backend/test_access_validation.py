from server import validate_access_passcode


def test_validate_access_passcode_requires_configuration_by_default(monkeypatch):
    monkeypatch.delenv("ENGINEERING_ACCESS_CODE", raising=False)
    monkeypatch.delenv("ALLOW_FALLBACK_ACCESS_CODES", raising=False)
    assert validate_access_passcode("engineering", "synthetic-unconfigured-code") is False


def test_validate_access_passcode_never_enables_literal_fallbacks(monkeypatch):
    monkeypatch.setenv("ALLOW_FALLBACK_ACCESS_CODES", "true")
    monkeypatch.delenv("ENGINEERING_ACCESS_CODE", raising=False)
    assert validate_access_passcode("engineering", "synthetic-unconfigured-code") is False


def test_validate_access_passcode_prefers_env_codes(monkeypatch):
    monkeypatch.delenv("ALLOW_FALLBACK_ACCESS_CODES", raising=False)
    monkeypatch.setenv("EDUCATION_ACCESS_CODE", "synthetic-education-code-2026")
    assert validate_access_passcode("education", " Synthetic-Education-Code-2026 ") is True
    assert validate_access_passcode("education", "synthetic-unconfigured-code") is False


def test_validate_access_passcode_rejects_blank_or_malformed_configuration(monkeypatch):
    monkeypatch.setenv("RESEARCHER_ACCESS_CODE", "   ")
    assert validate_access_passcode("researcher", "synthetic-research-code-2026") is False

    monkeypatch.setenv("RESEARCHER_ACCESS_CODE", "line\nbreak")
    assert validate_access_passcode("researcher", "line\nbreak") is False

    monkeypatch.setenv("RESEARCHER_ACCESS_CODE", "synthetic-research-code-2026\n")
    assert validate_access_passcode("researcher", "synthetic-research-code-2026") is False
