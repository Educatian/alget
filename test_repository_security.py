from __future__ import annotations

import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PLACEHOLDER_PREFIXES = ("replace-with-", "optional-")
ENV_ASSIGNMENT = re.compile(r"^(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*(.*)$")


def tracked_paths() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [ROOT / item.decode() for item in result.stdout.split(b"\0") if item]


def test_root_environment_file_cannot_be_present_and_tracked() -> None:
    tracked = {path.relative_to(ROOT).as_posix() for path in tracked_paths()}
    ignored_names = {
        line.strip()
        for line in (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    }
    assert not (ROOT / ".env").exists() or ".env" not in tracked, (
        "root .env must not be both present and tracked"
    )
    assert ".env" in ignored_names, "root .env must be ignored"


def test_committed_environment_contract_contains_placeholders_only() -> None:
    unsafe_paths: list[str] = []
    contract_path = ROOT / ".env.example"
    assert contract_path.is_file(), "root .env.example must document configuration"
    root_environment_paths = {
        path
        for path in tracked_paths()
        if path.parent == ROOT and path.name.startswith(".env") and path.is_file()
    }
    root_environment_paths.add(contract_path)
    for path in root_environment_paths:
        for line in path.read_text(encoding="utf-8").splitlines():
            match = ENV_ASSIGNMENT.fullmatch(line.strip())
            if match is None:
                continue
            value = match.group(1).strip()
            if value and not value.startswith(PLACEHOLDER_PREFIXES):
                unsafe_paths.append(path.relative_to(ROOT).as_posix())
                break
    assert not unsafe_paths, f"credential-bearing tracked configuration: {unsafe_paths}"


def test_production_access_validators_have_no_literal_fallback_path() -> None:
    validator_paths = [
        ROOT / "frontend/functions/api/access/validate.js",
        ROOT / "frontend/playwright.config.js",
        ROOT / "backend/server.py",
    ]
    forbidden_markers = ("ALLOW_FALLBACK_ACCESS_CODES", "fallback_by_scope", "const FALLBACK")
    offenders = [
        path.relative_to(ROOT).as_posix()
        for path in validator_paths
        if any(marker in path.read_text(encoding="utf-8") for marker in forbidden_markers)
    ]
    assert not offenders, f"literal production fallback path remains in: {offenders}"
