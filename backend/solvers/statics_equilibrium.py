# backend/solvers/statics_equilibrium.py
"""
Reference Solvers for Statics Equilibrium Problems

These provide deterministic, correct answers.
"""

import math
from typing import Dict, Any, Optional

# Physical constants
G = 9.81  # m/s² gravitational acceleration


def solve_tension_vertical(mass: float, g: float = G) -> Dict[str, Any]:
    """
    Solve for tension in a vertical cable supporting a mass.
    
    For a vertically hanging object: T = mg
    
    Args:
        mass: Mass in kg
        g: Gravitational acceleration (default 9.81 m/s²)
    
    Returns:
        Dict with expected_value, expected_unit, tolerance, steps
    """
    weight = mass * g
    tension = weight  # For vertical cable, T = W
    
    return {
        "expected_value": round(tension, 2),
        "expected_unit": "N",
        "tolerance": 0.01,
        "steps": [
            {
                "step_index": 1,
                "description": "Calculate weight W = mg",
                "formula": "W = m × g",
                "calculation": f"W = {mass} × {g} = {round(weight, 2)} N",
                "expected_value": round(weight, 2),
                "expected_unit": "N"
            },
            {
                "step_index": 2,
                "description": "For vertical equilibrium: T = W",
                "formula": "T = W",
                "calculation": f"T = {round(tension, 2)} N",
                "expected_value": round(tension, 2),
                "expected_unit": "N"
            }
        ]
    }


def solve_tension_inclined(mass: float, angle_deg: float, g: float = G) -> Dict[str, Any]:
    """
    Solve for tension in an inclined cable supporting a mass.
    
    Using ΣFy = 0: T·sin(θ) = mg
    Therefore: T = mg / sin(θ)
    
    Args:
        mass: Mass in kg
        angle_deg: Angle from horizontal in degrees
        g: Gravitational acceleration (default 9.81 m/s²)
    
    Returns:
        Dict with expected_value, expected_unit, tolerance, steps
    """
    angle_rad = math.radians(angle_deg)
    weight = mass * g
    tension = weight / math.sin(angle_rad)
    
    return {
        "expected_value": round(tension, 2),
        "expected_unit": "N",
        "tolerance": 0.02,
        "steps": [
            {
                "step_index": 1,
                "description": "Calculate weight W = mg",
                "formula": "W = m × g",
                "calculation": f"W = {mass} × {g} = {round(weight, 2)} N",
                "expected_value": round(weight, 2),
                "expected_unit": "N"
            },
            {
                "step_index": 2,
                "description": "Apply vertical equilibrium ΣFy = 0",
                "formula": "T·sin(θ) = W",
                "calculation": f"T·sin({angle_deg}°) = {round(weight, 2)}",
                "expected_value": None,
                "expected_unit": None
            },
            {
                "step_index": 3,
                "description": "Solve for T",
                "formula": "T = W / sin(θ)",
                "calculation": f"T = {round(weight, 2)} / sin({angle_deg}°) = {round(weight, 2)} / {round(math.sin(angle_rad), 4)} = {round(tension, 2)} N",
                "expected_value": round(tension, 2),
                "expected_unit": "N"
            }
        ]
    }


def solve_equilibrium_2d(
    forces: list,  # List of {"magnitude": float, "angle_deg": float, "direction": str}
    unknown_force_index: int
) -> Dict[str, Any]:
    """
    Solve for unknown force in 2D equilibrium.
    
    ΣFx = 0 and ΣFy = 0
    
    Args:
        forces: List of force dicts with magnitude, angle (from +x axis)
        unknown_force_index: Index of the unknown force to solve for
    
    Returns:
        Dict with expected magnitude and direction
    """
    sum_fx = 0
    sum_fy = 0
    
    for i, force in enumerate(forces):
        if i == unknown_force_index:
            continue
        
        angle_rad = math.radians(force["angle_deg"])
        fx = force["magnitude"] * math.cos(angle_rad)
        fy = force["magnitude"] * math.sin(angle_rad)
        
        sum_fx += fx
        sum_fy += fy
    
    # Unknown force must balance the sum
    unknown_fx = -sum_fx
    unknown_fy = -sum_fy
    unknown_magnitude = math.sqrt(unknown_fx**2 + unknown_fy**2)
    unknown_angle = math.degrees(math.atan2(unknown_fy, unknown_fx))
    
    return {
        "expected_value": round(unknown_magnitude, 2),
        "expected_unit": "N",
        "expected_angle": round(unknown_angle, 2),
        "tolerance": 0.02,
        "components": {
            "fx": round(unknown_fx, 2),
            "fy": round(unknown_fy, 2)
        }
    }


def solve_two_cable_system(
    mass: float,
    angle_a_deg: float,
    angle_b_deg: float,
    g: float = G
) -> Dict[str, Any]:
    """
    Solve for tensions in a two-cable system supporting a mass.
    
    Uses both ΣFx = 0 and ΣFy = 0 to solve for T_A and T_B.
    
    Args:
        mass: Mass in kg
        angle_a_deg: Angle of cable A from horizontal (degrees)
        angle_b_deg: Angle of cable B from horizontal (degrees)
        g: Gravitational acceleration
    
    Returns:
        Dict with tensions T_A and T_B
    """
    angle_a_rad = math.radians(angle_a_deg)
    angle_b_rad = math.radians(angle_b_deg)
    weight = mass * g
    
    # ΣFx = 0: T_A·cos(θ_A) = T_B·cos(θ_B)
    # ΣFy = 0: T_A·sin(θ_A) + T_B·sin(θ_B) = W
    
    # Solving the system:
    # T_A = W·cos(θ_B) / sin(θ_A + θ_B)
    # T_B = W·cos(θ_A) / sin(θ_A + θ_B)
    
    sin_sum = math.sin(angle_a_rad + angle_b_rad)
    
    T_A = (weight * math.cos(angle_b_rad)) / sin_sum
    T_B = (weight * math.cos(angle_a_rad)) / sin_sum
    
    return {
        "T_A": {
            "expected_value": round(T_A, 2),
            "expected_unit": "N",
            "tolerance": 0.02
        },
        "T_B": {
            "expected_value": round(T_B, 2),
            "expected_unit": "N",
            "tolerance": 0.02
        },
        "steps": [
            {
                "step_index": 1,
                "description": "Calculate weight",
                "expected_value": round(weight, 2),
                "expected_unit": "N"
            },
            {
                "step_index": 2,
                "description": "Apply ΣFx = 0 and ΣFy = 0",
                "expected_value": None,
                "expected_unit": None
            },
            {
                "step_index": 3,
                "description": f"Solve for T_A = W·cos(θ_B)/sin(θ_A+θ_B)",
                "expected_value": round(T_A, 2),
                "expected_unit": "N"
            },
            {
                "step_index": 4,
                "description": f"Solve for T_B = W·cos(θ_A)/sin(θ_A+θ_B)",
                "expected_value": round(T_B, 2),
                "expected_unit": "N"
            }
        ]
    }


# Solver registry for dynamic lookup
SOLVER_REGISTRY = {
    "statics_tension_vertical": solve_tension_vertical,
    "statics_tension_inclined": solve_tension_inclined,
    "statics_equilibrium_2d": solve_equilibrium_2d,
    "statics_two_cable": solve_two_cable_system
}


def get_solver(solver_id: str):
    """Get a solver function by its ID."""
    return SOLVER_REGISTRY.get(solver_id)


def run_solver(solver_id: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Run a solver with given parameters.
    
    Args:
        solver_id: ID of the solver
        params: Parameters to pass to the solver
    
    Returns:
        Solver result or None if solver not found
    """
    solver = get_solver(solver_id)
    if solver:
        return solver(**params)
    return None
