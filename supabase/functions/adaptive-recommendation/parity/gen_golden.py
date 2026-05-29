"""Emit expected (golden) policy outputs for each parity fixture.

Imports the SOURCE-OF-TRUTH pure policy from backend.knowledge_tracing and runs
select_support_move over every fixture, writing the results to golden.json. The
TS parity check (run_parity.mjs) runs the ported policy over the same fixtures
and asserts identical output.

Run from anywhere:
    python supabase/functions/adaptive-recommendation/parity/gen_golden.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# repo root = .../alget ; backend lives at <root>/backend
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, REPO_ROOT)

from backend.knowledge_tracing import select_support_move  # noqa: E402

FIXTURES = os.path.join(HERE, "fixtures.json")
GOLDEN = os.path.join(HERE, "golden.json")


def main() -> None:
    with open(FIXTURES, "r", encoding="utf-8") as fh:
        fixtures = json.load(fh)

    results = []
    for fx in fixtures:
        decision = select_support_move(
            dict(fx["features"]),
            annotation_adaptive=bool(fx.get("annotation_adaptive", True)),
            prefer_advance=bool(fx.get("prefer_advance", False)),
        )
        results.append({"name": fx["name"], "decision": decision})

    with open(GOLDEN, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, sort_keys=True)
    print(f"wrote {len(results)} golden records -> {GOLDEN}")


if __name__ == "__main__":
    main()
