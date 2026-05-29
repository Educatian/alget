# backend/solvers/truss.py
"""
Reference Solvers for Truss / Two-Force Member Problems (Statics CH01).

Deterministic answers. Accepts exactly the ``params`` keys present in the
corresponding practice.json ``params`` block.
"""

from typing import Any, Dict


def solve_truss_member(force_N: float, type: str = "tension") -> Dict[str, Any]:
    """Internal force magnitude in a two-force member.

    In a two-force member the force acts along the line joining the two pins;
    the magnitude is the given internal force regardless of tension/compression
    sense. ``type`` (tension/compression) only sets the reported sense.
    """
    magnitude = abs(force_N)
    sense = (type or "tension").strip().lower()
    return {
        "expected_value": round(magnitude, 4),
        "expected_unit": "N",
        "tolerance": 1.0,
        "sense": sense,
        "steps": [
            {
                "step_index": 1,
                "description": "Two-force member: internal force acts along the member axis",
                "formula": "F = |internal force|",
                "calculation": f"F = {magnitude} N ({sense})",
                "expected_value": round(magnitude, 4),
                "expected_unit": "N",
            }
        ],
    }


SOLVERS = {
    "solve_truss_member": solve_truss_member,
}
