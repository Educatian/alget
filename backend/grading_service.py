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
    tolerance: float = 0.01,  # relative tolerance (fraction) unless absolute=True
    require_unit: bool = True,
    tolerance_is_absolute: bool = False,
) -> dict:
    """
    Grade a numeric answer with optional unit.

    Args:
        user_answer: User's numeric answer as string
        user_unit: User's unit (can be empty)
        expected_value: Expected numeric value
        expected_unit: Expected unit
        tolerance: Tolerance. Relative fraction (e.g. 0.01 = 1%) by default; an
            absolute amount expressed in ``expected_unit`` when
            ``tolerance_is_absolute`` is True (the convention used by
            ``final_answer.tolerance`` in practice.json and by the solvers).
        require_unit: Whether unit is required
        tolerance_is_absolute: Interpret ``tolerance`` as an absolute amount.

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
    if tolerance_is_absolute:
        # Absolute tolerance is stated in the EXPECTED unit's own scale
        # (e.g. "1 N", "0.5 m", "0.1 deg"). Compare the user's value converted
        # into the expected unit, not base SI, so degree tolerances stay sane.
        user_in_expected = user_value
        if user_unit and expected_unit and check_units_compatible(user_unit, expected_unit):
            ub, _ = convert_to_base_unit(user_value, user_unit)
            eb_factor, _ = convert_to_base_unit(1.0, expected_unit)
            if eb_factor:
                user_in_expected = ub / eb_factor
        result["value_correct"] = abs(user_in_expected - expected_value) <= tolerance
    elif expected_base_value == 0:
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


# Sentinel so we can tell "key absent" from "key present and falsy (e.g. 0)".
_MISSING = object()

DEFAULT_TOLERANCE = 0.01


def normalize_expected_answer(problem: dict) -> Optional[dict]:
    """
    Normalize a problem's expected-answer shape into a flat dict.

    Supports two on-disk shapes:
      * nested ``final_answer``: {"value", "unit", "tolerance"}
      * flat: ``expected_value`` / ``expected_unit`` / ``tolerance``

    Returns a dict {expected_value, expected_unit, tolerance} or ``None`` when
    NEITHER shape carries an explicit value. Returning None (rather than
    defaulting to 0) lets the caller produce an explicit ungradable result
    instead of silently grading every correct answer as WRONG against 0.
    """
    final_answer = problem.get("final_answer")
    if isinstance(final_answer, dict) and final_answer.get("value", _MISSING) is not _MISSING:
        # final_answer tolerances are absolute amounts in the answer's unit.
        return {
            "expected_value": final_answer.get("value"),
            "expected_unit": final_answer.get("unit", "") or "",
            "tolerance": final_answer.get("tolerance", DEFAULT_TOLERANCE),
            "tolerance_is_absolute": True,
        }

    if problem.get("expected_value", _MISSING) is not _MISSING:
        # Flat legacy shape: tolerance is a relative fraction (e.g. 0.02 = 2%).
        return {
            "expected_value": problem.get("expected_value"),
            "expected_unit": problem.get("expected_unit", "") or "",
            "tolerance": problem.get("tolerance", DEFAULT_TOLERANCE),
            "tolerance_is_absolute": False,
        }

    return None


def _ungradable_result(reason: str, extra: Optional[dict] = None) -> dict:
    """Explicit 'not auto-graded' result. Never a false 'incorrect'."""
    result = {
        "is_correct": None,
        "auto_graded": False,
        "explanation": reason,
    }
    if extra:
        result.update(extra)
    return result


def grade_problem(problem: dict, user_answer: str, user_unit: str = "") -> dict:
    """
    Grade a problem based on its type.

    Args:
        problem: Problem definition dict with solver_id, expected_value, etc.
        user_answer: User's answer
        user_unit: User's unit (for numeric problems)

    Returns:
        Grading result dict. ``is_correct`` is True/False when auto-graded and
        ``None`` when the problem cannot be auto-graded (never a false False).
    """
    problem_type = problem.get("type", "numeric")

    if problem_type == "multiple_choice":
        return grade_multiple_choice(user_answer, problem.get("correct_answer", ""))

    # Conceptual / short-answer: not numerically gradable here. Route to the
    # LLM/rubric grader (/api/grade_summary) or mark self-assessed. Never fall
    # through to the numeric path (which would always mark it incorrect).
    if problem_type == "conceptual":
        return _ungradable_result(
            "This is a short-answer question and is not auto-graded here. "
            "Compare your response with the model answer, or submit it for "
            "rubric-based feedback.",
            {"expected": problem.get("expected_answer", "")},
        )

    if problem_type in ("numeric", "step_based"):
        expected = normalize_expected_answer(problem)
        if expected is None:
            return _ungradable_result(
                "This problem has no machine-checkable answer key, so it is "
                "not auto-graded."
            )

        result = grade_numeric_answer(
            user_answer=user_answer,
            user_unit=user_unit,
            expected_value=expected["expected_value"],
            expected_unit=expected["expected_unit"],
            tolerance=expected["tolerance"],
            require_unit=problem.get("require_unit", True),
            tolerance_is_absolute=expected["tolerance_is_absolute"],
        )
        result["auto_graded"] = True
        # Surface the worked steps as feedback for step_based problems.
        if problem_type == "step_based" and problem.get("steps"):
            result["steps"] = problem["steps"]
        return result

    return _ungradable_result(f"Problem type '{problem_type}' is not auto-graded.")


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
        # Aggregate registry spanning every solver module (kinematics,
        # friction, truss, statics_equilibrium).
        import solvers as solver_registry

        if solver_registry.get_solver(solver_id) is None:
            return _ungradable_result(
                f"Solver '{solver_id}' is not registered, so this problem "
                f"could not be auto-graded."
            )

        # Compute the reference answer deterministically from the givens.
        solver_result = solver_registry.run_solver(solver_id, solver_params)

        if not solver_result or solver_result.get("expected_value") is None:
            return _ungradable_result(
                f"Solver '{solver_id}' did not produce a checkable answer."
            )

        # Grade the learner answer against the solver's computed value.
        grade_result = grade_numeric_answer(
            user_answer=user_answer,
            user_unit=user_unit,
            expected_value=solver_result.get("expected_value"),
            expected_unit=solver_result.get("expected_unit", ""),
            tolerance=solver_result.get("tolerance", 0.02),
            require_unit=True,
            tolerance_is_absolute=True,
        )

        grade_result["auto_graded"] = True
        grade_result["solver_id"] = solver_id
        # Add solver steps to result for feedback
        grade_result["steps"] = solver_result.get("steps", [])

        return grade_result

    except Exception as e:
        return {
            "is_correct": False,
            "explanation": f"Solver error: {str(e)}"
        }
