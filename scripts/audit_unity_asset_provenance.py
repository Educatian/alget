"""Inventory Unity media/binary assets and fail closed on redistribution rights."""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


UNITY_ROOT = Path("C:/Users/jewoo/Projects/bio-inspired-edu-sims")
OUTPUT = Path(__file__).resolve().parents[1] / "research/evidence/unity_asset_provenance_2026-08-15.json"
PROJECTS = ("FinGripLabUnity", "GeckoGripLabUnity", "PineMorphLabUnity", "TrabeculaLabUnity")
ASSET_EXTENSIONS = {
    ".fbx", ".obj", ".blend", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".svg",
    ".ttf", ".otf", ".wav", ".mp3", ".ogg", ".dll", ".pdb",
}
LICENSE_NAME = {"license", "license.md", "license.txt", "licence", "licence.md", "licence.txt", "ofl.txt", "copying"}


def sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def classify(relative: str) -> dict:
    normalized = relative.casefold()
    if normalized.endswith("notosanskr-vf.ttf"):
        return {
            "origin_class": "third_party_font",
            "candidate_source": "https://github.com/google/fonts/tree/main/ofl/notosanskr",
            "candidate_license": "SIL Open Font License 1.1",
            "status": "license_identified_but_exact_binary_source_and_notice_copy_unverified",
            "redistribution_cleared": False,
        }
    if "/textmesh pro/" in "/" + normalized:
        return {
            "origin_class": "unity_package_asset",
            "candidate_source": "Unity TextMesh Pro package/sample assets",
            "candidate_license": "Unity package terms require project record review",
            "status": "package_provenance_and_redistribution_record_pending",
            "redistribution_cleared": False,
        }
    return {
        "origin_class": "project_media_or_model",
        "candidate_source": None,
        "candidate_license": None,
        "status": "authorship_ownership_and_ai_generation_record_pending",
        "redistribution_cleared": False,
    }


def main() -> None:
    rows = []
    license_files = []
    for project_name in PROJECTS:
        project = UNITY_ROOT / project_name
        assets = project / "Assets"
        for path in sorted((item for item in assets.rglob("*") if item.is_file()), key=lambda item: item.as_posix()):
            if path.name.casefold() in LICENSE_NAME:
                license_files.append({"project": project_name, "path": path.relative_to(project).as_posix()})
            if path.suffix.casefold() not in ASSET_EXTENSIONS:
                continue
            relative = path.relative_to(project).as_posix()
            rows.append({
                "project": project_name,
                "path": relative,
                "extension": path.suffix.casefold(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                **classify(relative),
            })
    status_counts = Counter(row["status"] for row in rows)
    project_counts = Counter(row["project"] for row in rows)
    report = {
        "schema_version": "1.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "audit_mode": "read_only_asset_inventory_no_rights_inference",
        "unity_root": str(UNITY_ROOT),
        "asset_count": len(rows),
        "asset_count_by_project": dict(sorted(project_counts.items())),
        "status_counts": dict(sorted(status_counts.items())),
        "license_files_found": license_files,
        "assets": rows,
        "checks": {
            "four_projects_inventoried": set(project_counts) == set(PROJECTS),
            "all_assets_fingerprinted": bool(rows) and all(len(row["sha256"]) == 64 for row in rows),
            "noto_sans_kr_identified_as_third_party": any(
                row["origin_class"] == "third_party_font" for row in rows
            ),
            "no_unsubstantiated_redistribution_clearance": all(
                row["redistribution_cleared"] is False for row in rows
            ),
        },
        "public_release_ready": False,
        "remaining_actions": [
            "Confirm creator/owner and any generative-AI provenance for each project_media_or_model asset.",
            "Match the Noto Sans KR binary to an authoritative distribution and archive the applicable OFL notice.",
            "Record Unity package/sample terms for any redistributed TextMesh Pro assets.",
            "Select the project code/content license only after ownership and third-party permissions are documented.",
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "asset_count": report["asset_count"],
        "asset_count_by_project": report["asset_count_by_project"],
        "status_counts": report["status_counts"],
        "license_files_found": len(license_files),
        "public_release_ready": report["public_release_ready"],
        "checks": report["checks"],
    }, indent=2))


if __name__ == "__main__":
    main()
