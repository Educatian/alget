# backend/grading_service.py - Grading Service with Solver Integration
"""
Service for grading answers using reference solvers.
Handles numeric comparison with tolerance and unit validation.
"""

import re
from typing import Optional, Tuple
from decimal import Decimal, InvalidOperation

# Unit conversion factors (to base SI units)
UNIT_CONVERSIONS = {
    # Force
    "N": 1.0,
    "kN": 1000.0,
    "lbf": 4.44822,
    "lb": 4.44822,
    
    # Length
    "m": 1.0,
    "cm": 0.01,
    "mm": 0.001,
    "km": 1000.0,
    "in": 0.0254,
    "ft": 0.3048,
    
    # Angle
    "rad": 1.0,
    "deg": 0.0174533,
    "°": 0.0174533,
    
    # Mass
    "kg": 1.0,
    "g": 0.001,
    "lb_mass": 0.453592,
    
    # Pressure
    "Pa": 1.0,
    "kPa": 1000.0,
    "MPa": 1000000.0,
    "psi": 6894.76,
}

# Unit equivalence groups
UNIT_GROUPS = {
    "force": ["N", "kN", "lbf", "lb"],
    "length": ["m", "cm", "mm", "km", "in", "ft"],
    "angle": ["rad", "deg", "°"],
    "mass": ["kg", "g", "lb_mass"],
    "pressure": ["Pa", "kPa", "MPa", "psi"],
}


def parse_numeric(value: str) -> Optional[float]:
    """Parse a numeric string to float."""
    try:
        # Remove whitespace and common formatting
        cleaned = value.strip().replace(",", "").replace(" ", "")
        
        # Handle scientific notation
        return float(cleaned)
    except (ValueError, InvalidOperation):
        return None


def normalize_unit(unit: str) -> str:
    """Normalize unit string."""
    return unit.strip().lower()


def get_unit_group(unit: str) -> Optional[str]:
    """Get the unit group for a given unit."""
    normalized = normalize_unit(unit)
    for group, units in UNIT_GROUPS.items():
        if normalized in [u.lower() for u in units]:
            return group
    return None


def convert_to_base_unit(value: float, unit: str) -> Tuple[float, str]:
    """Convert a value to its base SI unit."""
    for base_unit, factor in UNIT_CONVERSIONS.items():
        if normalize_unit(unit) == normalize_unit(base_unit):
            base_group = get_unit_group(base_unit)
            if base_group:
                # Find the base unit for this group
                base = list(UNIT_GROUPS[base_group])[0]
                return value * factor, base
    
    return value, unit


def check_units_compatible(user_unit: str, expected_unit: str) -> bool:
    """Check if two units are compatible (same physical quantity)."""
    if not user_unit or not expected_unit:
        return True
    
    user_group = get_unit_group(user_unit)
    expected_group = get_unit_group(expected_unit)
    
    if user_group and expected_group:
        return user_group == expected_group
    
    # If units not recognized, do direct comparison
    return normalize_unit(user_unit) == normalize_unit(expected_unit)


def grade_numeric_answer(
    user_answer: str,
    user_unit: str,
    expected_value: float,
    expected_unit: str,
    tolerance: float = 0.01,  # 1% relative tolerance
    require_unit: bool = True
) -> dict:
    """
    Grade a numeric answer with optional unit.
    
    Args:
        user_answer: User's numeric answer as string
        user_unit: User's unit (can be empty)
        expected_value: Expected numeric value
        expected_unit: Expected unit
        tolerance: Relative tolerance (e.g., 0.01 = 1%)
        require_unit: Whether unit is required
    
    Returns:
        Dict with is_correct, value_correct, unit_correct, unit_error, explanation
    """
    result = {
        "is_correct": False,
        "value_correct": False,
        "unit_correct": False,
        "unit_error": False,
        "expected": f"{expected_value} {expected_unit}",
        "explanation": ""
    }
    
    # Parse user's numeric value
    user_value = parse_numeric(user_answer)
    if user_value is None:
        result["explanation"] = "Could not parse your answer as a number."
        return result
    
    # Check unit compatibility
    if require_unit and expected_unit:
        if not user_unit:
            result["unit_error"] = True
            result["explanation"] = f"Please include the unit. Expected unit: {expected_unit}"
            return result
        
        if not check_units_compatible(user_unit, expected_unit):
            result["unit_error"] = True
            result["explanation"] = f"Unit mismatch. You used '{user_unit}', expected '{expected_unit}' or equivalent."
            return result
    
    # Convert both to base units for comparison
    user_base_value, user_base_unit = convert_to_base_unit(user_value, user_unit or expected_unit)
    expected_base_value, expected_base_unit = convert_to_base_unit(expected_value, expected_unit)
    
    # Check unit match
    result["unit_correct"] = normalize_unit(user_unit or "") == normalize_unit(expected_unit or "") or check_units_compatible(user_unit, expected_unit)
    
    # Check value within tolerance
    if expected_base_value == 0:
        result["value_correct"] = abs(user_base_value) < tolerance
    else:
        relative_error = abs(user_base_value - expected_base_value) / abs(expected_base_value)
        result["value_correct"] = relative_error <= tolerance
    
    # Overall correctness
    result["is_correct"] = result["value_correct"] and result["unit_correct"]
    
    # Generate explanation
    if result["is_correct"]:
        result["explanation"] = "Correct! Well done."
    elif result["value_correct"] and not result["unit_correct"]:
        result["explanation"] = f"The numeric value is correct, but check your units. Expected: {expected_unit}"
    elif not result["value_correct"] and result["unit_correct"]:
        result["explanation"] = f"The unit is correct, but the value is off. Expected: {expected_value}"
    else:
        result["explanation"] = f"Both value and unit need correction. Expected: {expected_value} {expected_unit}"
    
    return result


def grade_multiple_choice(user_answer: str, correct_answer: str) -> dict:
    """Grade a multiple choice answer."""
    is_correct = normalize_unit(user_answer) == normalize_unit(correct_answer)
    
    return {
        "is_correct": is_correct,
        "expected": correct_answer,
        "explanation": "Correct!" if is_correct else f"Incorrect. The correct answer is {correct_answer}."
    }


def grade_problem(problem: dict, user_answer: str, user_unit: str = "") -> dict:
    """
    Grade a problem based on its type.
    
    Args:
        problem: Problem definition dict with solver_id, expected_value, etc.
        user_answer: User's answer
        user_unit: User's unit (for numeric problems)
    
    Returns:
        Grading result dict
    """
    problem_type = problem.get("type", "numeric")
    
    if problem_type == "multiple_choice":
        return grade_multiple_choice(user_answer, problem.get("correct_answer", ""))
    
    elif problem_type == "numeric":
        return grade_numeric_answer(
            user_answer=user_answer,
            user_unit=user_unit,
            expected_value=problem.get("expected_value", 0),
            expected_unit=problem.get("expected_unit", ""),
            tolerance=problem.get("tolerance", 0.01),
            require_unit=problem.get("require_unit", True)
        )
    
    else:
        return {
            "is_correct": False,
            "explanation": f"Unknown problem type: {problem_type}"
        }


# =============================================================================
# SOLVER INTEGRATION
# =============================================================================

def grade_problem_with_solver(
    solver_id: str,
    solver_params: dict,
    user_answer: str,
    user_unit: str = ""
) -> dict:
    """
    Grade a problem using a reference solver.
    
    The solver computes the correct answer, then we grade the user's answer.
    
    Args:
        solver_id: ID of the solver to use
        solver_params: Parameters to pass to the solver
        user_answer: User's answer
        user_unit: User's unit
    
    Returns:
        Grading result dict with solver steps included
    """
    try:
        from solvers import statics_equilibrium
        
        # Get the correct answer from solver
        solver_result = statics_equilibrium.run_solver(solver_id, solver_params)
        
        if not solver_result:
            return {
                "is_correct": False,
                "explanation": f"Solver '{solver_id}' not found."
            }
        
        # Grade using the solver's expected values
        grade_result = grade_numeric_answer(
            user_answer=user_answer,
            user_unit=user_unit,
            expected_value=solver_result.get("expected_value", 0),
            expected_unit=solver_result.get("expected_unit", ""),
            tolerance=solver_result.get("tolerance", 0.02),
            require_unit=True
        )
        
        # Add solver steps to result for feedback
        grade_result["steps"] = solver_result.get("steps", [])
        
        return grade_result
        
    except Exception as e:
        return {
            "is_correct": False,
            "explanation": f"Solver error: {str(e)}"
        }
