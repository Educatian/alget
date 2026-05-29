# backend/solvers/kinematics.py
"""
Reference Solvers for Rectilinear Kinematics Problems (Dynamics CH01).

Deterministic, closed-form answers for the constant-acceleration kinematic
equations. Each solver returns the canonical result envelope used by the
grading layer:

    {
        "expected_value": float,
        "expected_unit": str,
        "tolerance": float,   # absolute tolerance (matches practice.json)
        "steps": [ {step_index, description, formula, calculation, ...}, ... ]
    }

Solvers accept exactly the ``params`` keys present in the corresponding
practice.json ``params`` block, so callers can splat the givens directly.
"""

import math
from typing import Any, Dict

G = 9.81  # m/s^2, default gravitational acceleration


def solve_kinematics_vf(v0: float, a: float, t: float) -> Dict[str, Any]:
    """Final velocity: v = v0 + a*t."""
    v = v0 + a * t
    return {
        "expected_value": round(v, 4),
        "expected_unit": "m/s",
        "tolerance": 0.1,
        "steps": [
            {
                "step_index": 1,
                "description": "Apply v = v0 + a*t",
                "formula": "v = v0 + a*t",
                "calculation": f"v = {v0} + {a}*{t} = {round(v, 4)} m/s",
                "expected_value": round(v, 4),
                "expected_unit": "m/s",
            }
        ],
    }


def solve_kinematics_distance(v0: float, a: float, v: float = 0.0) -> Dict[str, Any]:
    """Distance from v^2 = v0^2 + 2*a*s  ->  s = (v^2 - v0^2) / (2*a)."""
    s = (v ** 2 - v0 ** 2) / (2.0 * a)
    return {
        "expected_value": round(s, 4),
        "expected_unit": "m",
        "tolerance": 0.5,
        "steps": [
            {
                "step_index": 1,
                "description": "Apply v^2 = v0^2 + 2*a*s and solve for s",
                "formula": "s = (v^2 - v0^2) / (2*a)",
                "calculation": f"s = ({v}^2 - {v0}^2) / (2*{a}) = {round(s, 4)} m",
                "expected_value": round(s, 4),
                "expected_unit": "m",
            }
        ],
    }


def solve_kinematics_time(a: float, s: float, v0: float = 0.0, s0: float = 0.0) -> Dict[str, Any]:
    """Time from s = s0 + v0*t + 0.5*a*t^2 (smallest positive root)."""
    displacement = s - s0
    # 0.5*a*t^2 + v0*t - displacement = 0
    A = 0.5 * a
    B = v0
    C = -displacement
    if A == 0:
        # Linear: v0*t = displacement
        t = displacement / v0 if v0 != 0 else 0.0
    else:
        disc = B ** 2 - 4 * A * C
        disc = max(disc, 0.0)
        root = math.sqrt(disc)
        t1 = (-B + root) / (2 * A)
        t2 = (-B - root) / (2 * A)
        positives = [r for r in (t1, t2) if r >= 0]
        t = min(positives) if positives else max(t1, t2)
    return {
        "expected_value": round(t, 4),
        "expected_unit": "s",
        "tolerance": 0.1,
        "steps": [
            {
                "step_index": 1,
                "description": "Apply s = s0 + v0*t + 0.5*a*t^2 and solve for t",
                "formula": "0.5*a*t^2 + v0*t - (s - s0) = 0",
                "calculation": f"t = {round(t, 4)} s",
                "expected_value": round(t, 4),
                "expected_unit": "s",
            }
        ],
    }


def solve_kinematics_accel(v0: float, v: float, s: float) -> Dict[str, Any]:
    """Acceleration from v^2 = v0^2 + 2*a*s  ->  a = (v^2 - v0^2) / (2*s)."""
    a = (v ** 2 - v0 ** 2) / (2.0 * s)
    return {
        "expected_value": round(a, 4),
        "expected_unit": "m/s^2",
        "tolerance": 0.1,
        "steps": [
            {
                "step_index": 1,
                "description": "Apply v^2 = v0^2 + 2*a*s and solve for a",
                "formula": "a = (v^2 - v0^2) / (2*s)",
                "calculation": f"a = ({v}^2 - {v0}^2) / (2*{s}) = {round(a, 4)} m/s^2",
                "expected_value": round(a, 4),
                "expected_unit": "m/s^2",
            }
        ],
    }


def solve_kinematics_steps(v0: float, a: float, t: float) -> Dict[str, Any]:
    """Two-result step problem: final velocity then distance over time t.

    final_answer is the distance s = v0*t + 0.5*a*t^2.
    """
    v = v0 + a * t
    s = v0 * t + 0.5 * a * t ** 2
    return {
        "expected_value": round(s, 4),
        "expected_unit": "m",
        "tolerance": 0.5,
        "steps": [
            {
                "step_index": 1,
                "description": "Calculate final velocity using v = v0 + a*t",
                "formula": "v = v0 + a*t",
                "calculation": f"v = {v0} + {a}*{t} = {round(v, 4)} m/s",
                "expected_value": round(v, 4),
                "expected_unit": "m/s",
            },
            {
                "step_index": 2,
                "description": "Calculate distance using s = v0*t + 0.5*a*t^2",
                "formula": "s = v0*t + 0.5*a*t^2",
                "calculation": f"s = {v0}*{t} + 0.5*{a}*{t}^2 = {round(s, 4)} m",
                "expected_value": round(s, 4),
                "expected_unit": "m",
            },
        ],
    }


def solve_two_phase_motion(a1: float, t1: float, t2: float) -> Dict[str, Any]:
    """Acceleration phase then constant-velocity phase.

    Phase 1: accelerate from rest at a1 for t1 -> v = a1*t1, s1 = 0.5*a1*t1^2.
    Phase 2: constant velocity v for t2 -> s2 = v*t2.
    final_answer = total distance s1 + s2.
    """
    v = a1 * t1
    s1 = 0.5 * a1 * t1 ** 2
    s2 = v * t2
    total = s1 + s2
    return {
        "expected_value": round(total, 4),
        "expected_unit": "m",
        "tolerance": 0.5,
        "steps": [
            {
                "step_index": 1,
                "description": "Velocity at end of acceleration phase: v = a1*t1",
                "formula": "v = a1*t1",
                "calculation": f"v = {a1}*{t1} = {round(v, 4)} m/s",
                "expected_value": round(v, 4),
                "expected_unit": "m/s",
            },
            {
                "step_index": 2,
                "description": "Distance during acceleration: s1 = 0.5*a1*t1^2",
                "formula": "s1 = 0.5*a1*t1^2",
                "calculation": f"s1 = 0.5*{a1}*{t1}^2 = {round(s1, 4)} m",
                "expected_value": round(s1, 4),
                "expected_unit": "m",
            },
            {
                "step_index": 3,
                "description": "Distance during constant velocity: s2 = v*t2",
                "formula": "s2 = v*t2",
                "calculation": f"s2 = {round(v, 4)}*{t2} = {round(s2, 4)} m",
                "expected_value": round(s2, 4),
                "expected_unit": "m",
            },
            {
                "step_index": 4,
                "description": "Total distance: s = s1 + s2",
                "formula": "s = s1 + s2",
                "calculation": f"s = {round(s1, 4)} + {round(s2, 4)} = {round(total, 4)} m",
                "expected_value": round(total, 4),
                "expected_unit": "m",
            },
        ],
    }


SOLVERS = {
    "solve_kinematics_vf": solve_kinematics_vf,
    "solve_kinematics_distance": solve_kinematics_distance,
    "solve_kinematics_time": solve_kinematics_time,
    "solve_kinematics_accel": solve_kinematics_accel,
    "solve_kinematics_steps": solve_kinematics_steps,
    "solve_two_phase_motion": solve_two_phase_motion,
}
