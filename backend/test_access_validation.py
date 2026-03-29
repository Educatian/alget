from server import validate_access_passcode


def test_validate_access_passcode_uses_server_side_fallback_codes():
    assert validate_access_passcode("engineering", "eng123") is True
    assert validate_access_passcode("education", "edu123") is True
    assert validate_access_passcode("researcher", "immersivebama") is True
    assert validate_access_passcode("engineering", "wrong") is False
