from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]) -> tuple[int, str]:
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    return proc.returncode, proc.stdout + proc.stderr


def main() -> int:
    checks: list[dict[str, object]] = []
    commands = [
        ["python", "backend/content_audit.py"],
        ["python", "backend/content_quality_audit.py"],
        ["python", "backend/knowledge_model_validation.py", "--output-dir", "research/model_validation", "--seed", "42"],
    ]
    for cmd in commands:
        code, output = run(cmd)
        checks.append({"command": " ".join(cmd), "exit_code": code, "passed": code == 0, "output_tail": output[-1200:]})

    quality = (ROOT / "backend/content_quality_audit_report.md").read_text(encoding="utf-8")
    validation = json.loads((ROOT / "research/model_validation/learner_model_validation.json").read_text(encoding="utf-8"))
    quality_passes = (
        "| ail606-supplement | 64 |" in quality
        and "| cat531-supplement | 64 |" in quality
        and "| cat100-supplement | 64 |" in quality
        and "| 0 | 64 | 0 |" in quality
    )
    readiness = {
        "content_quality_below_threshold_zero": quality_passes,
        "all_supplement_sections_hardened": sum("top_tier_hardened" in p.read_text(encoding="utf-8") for p in (ROOT / "frontend/content").rglob("*.meta.json")) >= 192,
        "deep_exemplar_pngs": len(list((ROOT / "frontend/public/course-art/deep-exemplars").rglob("*.png"))),
        "artifact_packets": len(list((ROOT / "frontend/public/downloads/summer2026").rglob("*.md"))),
        "learner_model_variants": [row["model"] for row in validation],
    }
    checks.append({"command": "readiness assertions", "exit_code": 0, "passed": all([
        readiness["content_quality_below_threshold_zero"],
        readiness["all_supplement_sections_hardened"],
        readiness["deep_exemplar_pngs"] >= 192,
        readiness["artifact_packets"] >= 192,
        len(readiness["learner_model_variants"]) >= 5,
    ]), "readiness": readiness})

    out = ROOT / "research/reproducibility_smoke_report.json"
    out.write_text(json.dumps(checks, indent=2), encoding="utf-8")

    md = ROOT / "research/reproducibility_smoke_report.md"
    lines = ["# ALGET Reproducibility Smoke Report", ""]
    for check in checks:
        lines.append(f"- {'PASS' if check['passed'] else 'FAIL'} `{check['command']}`")
    lines.append("")
    lines.append("This smoke report verifies the content audit, strict quality audit, learner-model validation harness, hardened section count, deep exemplar visuals, and artifact packets.")
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(md)
    return 0 if all(check["passed"] for check in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
