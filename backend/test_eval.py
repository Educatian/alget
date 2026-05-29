import os
import socket
import sys

import pytest

try:
    import requests
except ImportError:  # pragma: no cover - requests optional for pure unit tests
    requests = None

# Make backend modules (grading_service, solvers, content_service) importable
# regardless of pytest's rootdir, without dragging in supabase/server imports.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import grading_service  # noqa: E402
import solvers  # noqa: E402
from content_service import collect_referenced_solver_ids  # noqa: E402


# ---------------------------------------------------------------------------
# Pure unit tests (no network / no Supabase). These import only
# grading_service, solvers, and content_service (content-file scan).
# ---------------------------------------------------------------------------

# (i) known-correct answers grade True, wrong answers grade False, across the
# three answer shapes: numeric-flat, numeric-final_answer, and step_based.
_GRADE_CASES = [
    # (problem, correct_answer, correct_unit, wrong_answer)
    pytest.param(
        {
            "type": "numeric",
            "expected_value": 245.25,
            "expected_unit": "N",
            "tolerance": 0.02,
        },
        "245.25", "N", "100",
        id="numeric-flat",
    ),
    pytest.param(
        {
            "type": "numeric",
            "final_answer": {"value": 24, "unit": "m/s", "tolerance": 0.1},
        },
        "24", "m/s", "5",
        id="numeric-final_answer",
    ),
    pytest.param(
        {
            "type": "step_based",
            "final_answer": {"value": 84, "unit": "m", "tolerance": 0.5},
            "steps": [{"step_id": 1, "description": "v = v0 + at"}],
        },
        "84", "m", "10",
        id="step_based-final_answer",
    ),
]


@pytest.mark.parametrize("problem,correct,unit,wrong", _GRADE_CASES)
def test_known_correct_grades_true(problem, correct, unit, wrong):
    result = grading_service.grade_problem(problem, correct, unit)
    assert result["is_correct"] is True, result


@pytest.mark.parametrize("problem,correct,unit,wrong", _GRADE_CASES)
def test_known_wrong_grades_false(problem, correct, unit, wrong):
    result = grading_service.grade_problem(problem, wrong, unit)
    assert result["is_correct"] is False, result


def test_step_based_surfaces_steps_as_feedback():
    problem = {
        "type": "step_based",
        "final_answer": {"value": 84, "unit": "m", "tolerance": 0.5},
        "steps": [{"step_id": 1, "description": "v = v0 + at"}],
    }
    result = grading_service.grade_problem(problem, "84", "m")
    assert result.get("steps"), "step_based grading should surface steps[]"


def test_missing_answer_key_is_ungradable_not_false():
    """A numeric problem with no answer key must NOT be a false 'incorrect'."""
    problem = {"type": "numeric"}  # no final_answer, no expected_value
    result = grading_service.grade_problem(problem, "42", "N")
    assert result["is_correct"] is None
    assert result.get("auto_graded") is False


def test_conceptual_is_ungradable_not_false():
    problem = {"type": "conceptual", "expected_answer": "They must be concurrent"}
    result = grading_service.grade_problem(problem, "anything", "")
    assert result["is_correct"] is None
    assert result.get("auto_graded") is False


# (ii) every solver_id referenced anywhere in frontend/content must resolve.
def test_all_content_solver_ids_resolve():
    referenced = collect_referenced_solver_ids()
    assert referenced, "Expected content to reference at least one solver_id"
    unresolved = sorted(sid for sid in referenced if solvers.get_solver(sid) is None)
    assert not unresolved, f"Unresolved solver_id(s): {unresolved}"


def test_solver_computes_known_kinematics_answer():
    """Spot-check a solver recomputes the published practice answer."""
    result = solvers.run_solver("solve_kinematics_vf", {"v0": 0, "a": 3, "t": 8})
    assert result is not None
    assert abs(result["expected_value"] - 24) < 0.1


def test_solver_grading_wrong_answer_is_false():
    """A clearly-wrong learner answer must grade False through the solver path.

    Guards the absolute-vs-relative tolerance regression: a friction tolerance
    of 1 (N) must NOT be read as 100% relative tolerance.
    """
    wrong = grading_service.grade_problem_with_solver(
        "solve_max_friction", {"mass_kg": 80, "mu_s": 0.35, "g": 9.81}, "100", "N"
    )
    assert wrong["is_correct"] is False
    right = grading_service.grade_problem_with_solver(
        "solve_max_friction", {"mass_kg": 80, "mu_s": 0.35, "g": 9.81}, "274.7", "N"
    )
    assert right["is_correct"] is True


def test_absolute_tolerance_rejects_near_miss():
    """final_answer tolerance is absolute, not relative: 24.5 is outside 0.1."""
    problem = {"type": "numeric", "final_answer": {"value": 24, "unit": "m/s", "tolerance": 0.1}}
    assert grading_service.grade_problem(problem, "24.5", "m/s")["is_correct"] is False
    assert grading_service.grade_problem(problem, "24.05", "m/s")["is_correct"] is True


def _local_server_available(host: str = "127.0.0.1", port: int = 8000) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex((host, port)) == 0


@pytest.mark.skipif(
    requests is None or not _local_server_available(),
    reason="requests unavailable or local backend not running on http://127.0.0.1:8000.",
)
def test_orchestrate_evaluate_endpoint_responds():
    response = requests.post(
        "http://127.0.0.1:8000/api/orchestrate",
        json={
            "query": "Evaluate my design: I want to make a train purely out of kingfisher feathers to reduce drag.",
            "grade_level": "Undergraduate",
            "interest": "Aerospace Engineering",
            "history": [],
        },
        timeout=30,
    )

    assert response.status_code == 200
