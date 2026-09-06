"""Audit ALGET's four Unity WebGL interventions without changing deployments.

The audit fingerprints governed Unity source inputs, fingerprints each local
WebGL build, downloads the deployed immutable assets, and proves whether the
deployed bytes equal the local build bytes. It records Git state without
including file names from dirty/untracked worktrees.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


DEFAULT_UNITY_ROOT = Path("C:/Users/jewoo/Projects/bio-inspired-edu-sims")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "research/evidence/unity_build_provenance_2026-08-15.json"
SOURCE_ROOTS = ("Assets", "Packages", "ProjectSettings")
REMOTE_FILES = (
    "index.html",
    "Build/WebGL.loader.js",
    "Build/WebGL.data.unityweb",
    "Build/WebGL.framework.js.unityweb",
    "Build/WebGL.wasm.unityweb",
)
PROJECTS = {
    "fingrip": {
        "directory": "FinGripLabUnity",
        "url": "https://fingrip-lab-unity.pages.dev/",
    },
    "geckogrip": {
        "directory": "GeckoGripLabUnity",
        "url": "https://geckogrip-lab-unity.pages.dev/",
    },
    "pinemorph": {
        "directory": "PineMorphLabUnity",
        "url": "https://pinemorph-lab-unity.pages.dev/",
    },
    "trabecula": {
        "directory": "TrabeculaLabUnity",
        "url": "https://trabecula-lab-unity.pages.dev/",
    },
}
APPROVED_PARENT_ORIGINS = {
    "https://alget.pages.dev",
    "https://engineering-study-qa-2026081.alget.pages.dev",
    "https://8361ea86.alget.pages.dev",
}
BRIDGE_PATHS = {
    "fingrip": "Assets/Plugins/WebGL/FinGripWebGL.jslib",
    "geckogrip": "Assets/Plugins/WebGL/GeckoGripWebGL.jslib",
    "pinemorph": "Assets/Plugins/WebGL/PineMorphWebGL.jslib",
    "trabecula": "Assets/Plugins/WebGL/TrabeculaLab.jslib",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def manifest_digest(rows: Iterable[dict]) -> str:
    payload = "".join(
        json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n"
        for row in sorted(rows, key=lambda item: item["path"])
    ).encode("utf-8")
    return sha256_bytes(payload)


def fingerprint_tree(root: Path, selected_roots: Iterable[str] | None = None) -> dict:
    candidates: list[Path] = []
    if selected_roots is None:
        candidates = [path for path in root.rglob("*") if path.is_file()]
    else:
        for selected in selected_roots:
            selected_path = root / selected
            if selected_path.exists():
                candidates.extend(path for path in selected_path.rglob("*") if path.is_file())
    rows = []
    for path in sorted(set(candidates), key=lambda item: item.relative_to(root).as_posix()):
        rows.append({
            "path": path.relative_to(root).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        })
    return {
        "file_count": len(rows),
        "total_bytes": sum(row["bytes"] for row in rows),
        "manifest_sha256": manifest_digest(rows),
        "files": rows,
    }


def git_value(project: Path, *args: str) -> str | None:
    result = subprocess.run(
        ["git", "-C", str(project), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def git_state(project: Path) -> dict:
    is_repo = git_value(project, "rev-parse", "--is-inside-work-tree") == "true"
    if not is_repo:
        return {
            "is_repository": False,
            "head_commit": None,
            "branch": None,
            "dirty_entry_count": None,
            "source_commit_provenance_complete": False,
        }
    status = git_value(project, "status", "--porcelain", "--untracked-files=all") or ""
    return {
        "is_repository": True,
        "head_commit": git_value(project, "rev-parse", "HEAD"),
        "branch": git_value(project, "branch", "--show-current") or "DETACHED",
        "dirty_entry_count": len(status.splitlines()) if status else 0,
        "source_commit_provenance_complete": not bool(status),
    }


def fetch(url: str, *, accept_brotli: bool) -> tuple[bytes, dict]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ALGET-Unity-Provenance-Audit/1.0",
            "Accept-Encoding": "br, identity" if accept_brotli else "identity",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
        headers = {key.lower(): value for key, value in response.headers.items()}
        return body, {
            "status": response.status,
            "final_url": response.url,
            "content_type": headers.get("content-type"),
            "content_encoding": headers.get("content-encoding"),
            "cache_control": headers.get("cache-control"),
            "etag": headers.get("etag"),
        }


def audit_project(key: str, config: dict, unity_root: Path) -> dict:
    project = unity_root / config["directory"]
    build_root = project / "Builds/WebGL"
    version_path = project / "ProjectSettings/ProjectVersion.txt"
    version_line = version_path.read_text(encoding="utf-8").splitlines()[0] if version_path.exists() else None
    source = fingerprint_tree(project, SOURCE_ROOTS)
    local_build = fingerprint_tree(build_root)
    remote_rows = []
    for relative in REMOTE_FILES:
        local_path = build_root / relative
        row = {
            "path": relative,
            "local_exists": local_path.exists(),
            "local_bytes": local_path.stat().st_size if local_path.exists() else None,
            "local_sha256": sha256_file(local_path) if local_path.exists() else None,
        }
        try:
            body, response = fetch(
                config["url"] + relative,
                accept_brotli=relative.endswith(".unityweb"),
            )
            row.update(response)
            row.update({
                "remote_bytes": len(body),
                "remote_sha256": sha256_bytes(body),
                "matches_local": local_path.exists() and sha256_file(local_path) == sha256_bytes(body),
                "error": None,
            })
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            row.update({
                "status": None,
                "remote_bytes": None,
                "remote_sha256": None,
                "matches_local": False,
                "error": type(exc).__name__,
            })
        remote_rows.append(row)
    git = git_state(project)
    build_assets = [row for row in remote_rows if row["path"].startswith("Build/")]
    compression_rows = [row for row in build_assets if row["path"].endswith(".unityweb")]
    loader_rows = [row for row in build_assets if row["path"].endswith("loader.js")]
    exact_bytes = bool(remote_rows) and all(row["matches_local"] for row in remote_rows)
    transport_headers = (
        all(row.get("status") == 200 for row in build_assets)
        and len(compression_rows) == 3
        and all(row.get("content_encoding") == "br" for row in compression_rows)
        and all("immutable" in (row.get("cache_control") or "") for row in compression_rows)
        and len(loader_rows) == 1
        and all("javascript" in (row.get("content_type") or "") for row in loader_rows)
    )
    return {
        "key": key,
        "project_directory": str(project),
        "unity_version": version_line,
        "git": git,
        "source_fingerprint": {key: value for key, value in source.items() if key != "files"},
        "source_file_manifest": source["files"],
        "local_build_fingerprint": local_build,
        "deployment_url": config["url"],
        "remote_files": remote_rows,
        "deployed_bytes_match_local_build": exact_bytes,
        "brotli_and_immutable_headers_pass": transport_headers,
        "build_provenance_complete": exact_bytes and transport_headers,
        "source_commit_provenance_complete": git["source_commit_provenance_complete"],
    }


def trabecula_confidence_qa(unity_root: Path) -> dict:
    project = unity_root / PROJECTS["trabecula"]["directory"]
    evidence_path = project / "Assets/TrabeculaLab/Runtime/TrabeculaEvidence.cs"
    test_path = project / "Assets/Tests/EditMode/TrabeculaPhysicsTests.cs"
    result_path = project / "TestResults-confidence.xml"
    build_log_path = project / "unity-build-confidence.log"
    evidence_source = evidence_path.read_text(encoding="utf-8") if evidence_path.exists() else ""
    test_source = test_path.read_text(encoding="utf-8") if test_path.exists() else ""
    test_summary = {"exists": result_path.exists(), "sha256": None, "result": None, "total": 0, "passed": 0, "failed": 0}
    if result_path.exists():
        root = ET.parse(result_path).getroot()
        test_summary.update({
            "sha256": sha256_file(result_path),
            "result": root.attrib.get("result"),
            "total": int(root.attrib.get("total", 0)),
            "passed": int(root.attrib.get("passed", 0)),
            "failed": int(root.attrib.get("failed", 0)),
        })
    build_log = build_log_path.read_text(encoding="utf-8", errors="replace") if build_log_path.exists() else ""
    checks = {
        "fraction_to_percent_normalization_present": "confidence=Mathf.Clamp01(c)*100f" in evidence_source,
        "normalization_regression_test_present": "EvidenceNormalizesFractionalConfidenceToPercent" in test_source,
        "unity_editmode_tests_pass": (
            test_summary["result"] == "Passed"
            and test_summary["total"] >= 5
            and test_summary["passed"] == test_summary["total"]
            and test_summary["failed"] == 0
        ),
        "webgl_clean_build_succeeded": "TRABECULALAB_WEBGL_BUILD_OK" in build_log,
    }
    return {
        "status": "pass" if all(checks.values()) else "fail",
        "confidence_contract": "Unity UI fraction 0..1 is emitted as research percentage 0..100",
        "checks": checks,
        "test_result": test_summary,
        "build_log_sha256": sha256_file(build_log_path) if build_log_path.exists() else None,
    }


def telemetry_origin_qa(unity_root: Path) -> dict:
    projects = {}
    for key, relative in BRIDGE_PATHS.items():
        path = unity_root / PROJECTS[key]["directory"] / relative
        source = path.read_text(encoding="utf-8") if path.exists() else ""
        checks = {
            "bridge_exists": path.exists(),
            "all_approved_origins_present": all(origin in source for origin in APPROVED_PARENT_ORIGINS),
            "localhost_allowed": 'parsed.hostname === "localhost"' in source or 'parsed.hostname==="localhost"' in source,
            "loopback_allowed": 'parsed.hostname === "127.0.0.1"' in source or 'parsed.hostname==="127.0.0.1"' in source,
            "wildcard_target_absent": 'postMessage(' not in source or ', "*")' not in source,
            "arbitrary_https_origin_absent": 'parsed.protocol === "https:"' not in source and 'parsed.protocol==="https:"' not in source,
        }
        projects[key] = {
            "path": relative,
            "sha256": sha256_file(path) if path.exists() else None,
            "checks": checks,
            "status": "pass" if all(checks.values()) else "fail",
        }
    return {
        "approved_parent_origins": sorted(APPROVED_PARENT_ORIGINS),
        "projects": projects,
        "status": "pass" if all(row["status"] == "pass" for row in projects.values()) else "fail",
    }


def build_report(unity_root: Path) -> dict:
    projects = {key: audit_project(key, config, unity_root) for key, config in PROJECTS.items()}
    confidence_qa = trabecula_confidence_qa(unity_root)
    origin_qa = telemetry_origin_qa(unity_root)
    return {
        "schema_version": "1.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "audit_mode": "read_only_local_hash_and_remote_get",
        "production_changed": False,
        "unity_root": str(unity_root),
        "projects": projects,
        "trabecula_confidence_qa": confidence_qa,
        "telemetry_origin_qa": origin_qa,
        "checks": {
            "four_projects_present": len(projects) == 4,
            "all_use_unity_6000_4_9f1": all(
                row["unity_version"] == "m_EditorVersion: 6000.4.9f1" for row in projects.values()
            ),
            "all_deployed_bytes_match_local_build": all(
                row["deployed_bytes_match_local_build"] for row in projects.values()
            ),
            "all_build_transport_headers_pass": all(
                row["brotli_and_immutable_headers_pass"] for row in projects.values()
            ),
            "all_build_provenance_complete": all(
                row["build_provenance_complete"] for row in projects.values()
            ),
            "all_source_commit_provenance_complete": all(
                row["source_commit_provenance_complete"] for row in projects.values()
            ),
            "trabecula_source_is_version_controlled": projects["trabecula"]["git"]["is_repository"],
            "trabecula_confidence_contract_pass": confidence_qa["status"] == "pass",
            "all_telemetry_bridges_use_exact_parent_origin_allowlist": origin_qa["status"] == "pass",
        },
        "build_deployment_status": "pass" if all(
            row["build_provenance_complete"] for row in projects.values()
        ) else "fail",
        "source_commit_status": "pass" if all(
            row["source_commit_provenance_complete"] for row in projects.values()
        ) else "hold",
        "remaining_hold": "Trabecula source is not version controlled and any dirty Unity source tree must be committed/tagged before preregistration",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--unity-root", type=Path, default=DEFAULT_UNITY_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = build_report(args.unity_root.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    summary = {
        "build_deployment_status": report["build_deployment_status"],
        "source_commit_status": report["source_commit_status"],
        "checks": report["checks"],
        "output": str(args.output),
    }
    print(json.dumps(summary, indent=2))
    if report["build_deployment_status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
