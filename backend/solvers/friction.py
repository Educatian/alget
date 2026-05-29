# backend/solvers/friction.py
"""
Reference Solvers for Dry Friction Problems (Statics CH01 / friction section).

Deterministic, closed-form answers. Each solver returns the canonical result
envelope used by the grading layer and accepts exactly the ``params`` keys
present in the corresponding practice.json ``params`` block.
"""

import math
from typing import Any, Dict

G = 9.81  # m/s^2, default gravitational acceleration


def solve_max_friction(mass_kg: float, mu_s: float, g: float = G) -> Dict[str, Any]:
    """Maximum static friction on a horizontal surface: (Fs)max = mu_s * N = mu_s * m*g."""
    N = mass_kg * g
    fs_max = mu_s * N
    return {
        "expected_value": round(fs_max, 4),
        "expected_unit": "N",
        "tolerance": 1.0,
        "steps": [
            {
                "step_index": 1,
                "description": "Normal force N = m*g",
                "formula": "N = m*g",
                "calculation": f"N = {mass_kg}*{g} = {round(N, 4)} N",
                "expected_value": round(N, 4),
                "expected_unit": "N",
            },
            {
                "step_index": 2,
                "description": "Maximum static friction (Fs)max = mu_s*N",
                "formula": "(Fs)max = mu_s*N",
                "calculation": f"(Fs)max = {mu_s}*{round(N, 4)} = {round(fs_max, 4)} N",
                "expected_value": round(fs_max, 4),
                "expected_unit": "N",
            },
        ],
    }


def solve_impending_friction(mass_kg: float, mu_s: float, g: float = G) -> Dict[str, Any]:
    """Horizontal push P for impending motion on a flat surface: P = mu_s * m*g."""
    N = mass_kg * g
    P = mu_s * N
    return {
        "expected_value": round(P, 4),
        "expected_unit": "N",
        "tolerance": 1.0,
        "steps": [
            {
                "step_index": 1,
                "description": "Normal force N = m*g",
                "formula": "N = m*g",
                "calculation": f"N = {mass_kg}*{g} = {round(N, 4)} N",
                "expected_value": round(N, 4),
                "expected_unit": "N",
            },
            {
                "step_index": 2,
                "description": "At impending motion P = (Fs)max = mu_s*N",
                "formula": "P = mu_s*N",
                "calculation": f"P = {mu_s}*{round(N, 4)} = {round(P, 4)} N",
                "expected_value": round(P, 4),
                "expected_unit": "N",
            },
        ],
    }


def solve_friction_angle(mu_s: float) -> Dict[str, Any]:
    """Angle of repose for impending slip on an incline: theta = atan(mu_s)."""
    theta_rad = math.atan(mu_s)
    theta_deg = math.degrees(theta_rad)
    return {
        "expected_value": round(theta_deg, 4),
        "expected_unit": "deg",
        "tolerance": 0.5,
        "steps": [
            {
                "step_index": 1,
                "description": "At impending slip: m*g*sin(theta) = mu_s*m*g*cos(theta) -> tan(theta) = mu_s",
                "formula": "theta = atan(mu_s)",
                "calculation": f"theta = atan({mu_s}) = {round(theta_deg, 4)} deg",
                "expected_value": round(theta_deg, 4),
                "expected_unit": "deg",
            }
        ],
    }


def solve_friction_incline_steps(
    mass_kg: float, angle_deg: float, mu_s: float, g: float = G
) -> Dict[str, Any]:
    """Block on an incline: determine slip and the actual friction force.

    Steps:
      1. W_parallel = m*g*sin(theta)
      2. N          = m*g*cos(theta)
      3. (Fs)max    = mu_s*N
      4. If (Fs)max >= W_parallel the block holds and the actual friction force
         equals W_parallel; otherwise it slips and friction = (Fs)max.
    final_answer = actual friction force.
    """
    theta = math.radians(angle_deg)
    w_par = mass_kg * g * math.sin(theta)
    N = mass_kg * g * math.cos(theta)
    fs_max = mu_s * N
    slips = fs_max < w_par
    actual_friction = fs_max if slips else w_par
    verdict = "slips" if slips else "does NOT slip"
    return {
        "expected_value": round(actual_friction, 4),
        "expected_unit": "N",
        "tolerance": 1.0,
        "slips": slips,
        "steps": [
            {
                "step_index": 1,
                "description": "Weight component parallel to incline W_par = m*g*sin(theta)",
                "formula": "W_par = m*g*sin(theta)",
                "calculation": f"W_par = {mass_kg}*{g}*sin({angle_deg}) = {round(w_par, 4)} N",
                "expected_value": round(w_par, 4),
                "expected_unit": "N",
            },
            {
                "step_index": 2,
                "description": "Normal force N = m*g*cos(theta)",
                "formula": "N = m*g*cos(theta)",
                "calculation": f"N = {mass_kg}*{g}*cos({angle_deg}) = {round(N, 4)} N",
                "expected_value": round(N, 4),
                "expected_unit": "N",
            },
            {
                "step_index": 3,
                "description": "Maximum static friction (Fs)max = mu_s*N",
                "formula": "(Fs)max = mu_s*N",
                "calculation": f"(Fs)max = {mu_s}*{round(N, 4)} = {round(fs_max, 4)} N",
                "expected_value": round(fs_max, 4),
                "expected_unit": "N",
            },
            {
                "step_index": 4,
                "description": f"Compare (Fs)max vs W_par: block {verdict}; actual friction force",
                "formula": "F = W_par if it holds, else (Fs)max",
                "calculation": f"F = {round(actual_friction, 4)} N",
                "expected_value": round(actual_friction, 4),
                "expected_unit": "N",
            },
        ],
    }


SOLVERS = {
    "solve_max_friction": solve_max_friction,
    "solve_impending_friction": solve_impending_friction,
    "solve_friction_angle": solve_friction_angle,
    "solve_friction_incline_steps": solve_friction_incline_steps,
}
