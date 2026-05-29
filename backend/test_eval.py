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


# ---------------------------------------------------------------------------
# Solver coverage + generic family dispatch.
# ---------------------------------------------------------------------------

def test_new_dynamics_solvers_compute_known_answers():
    """The added closed-form solvers recompute the published practice answers."""
    cases = [
        ("solve_newton_second_law", {"force_N": 20, "mass_kg": 5}, 4.0),
        ("solve_kinetic_energy", {"mass_kg": 6, "v": 4}, 48.0),
        ("solve_linear_momentum", {"mass_kg": 4, "v": 8}, 32.0),
        ("solve_impulse", {"force_N": 15, "time_s": 2}, 30.0),
        ("solve_perfectly_inelastic_collision", {"m1": 2, "v1": 8, "m2": 2, "v2": 2}, 5.0),
        ("solve_rim_speed", {"omega": 2.5, "radius_m": 2.0}, 5.0),
        ("solve_moment_perpendicular", {"force_N": 90, "distance_m": 5}, 450.0),
    ]
    for solver_id, params, expected in cases:
        result = solvers.run_solver(solver_id, params)
        assert result is not None, solver_id
        assert abs(result["expected_value"] - expected) < 0.05, (solver_id, result)
        assert result.get("steps"), f"{solver_id} should surface worked steps"


def test_generic_family_dispatch_resolves_family_named_ids():
    """A solver_id that names a family resolves via generic dispatch, and the
    exact-id path still takes precedence over the generic fallback."""
    # Family-named id (no exact function) resolves through the prefix dispatch.
    assert solvers.get_solver("dyn_newton_basic_numeric") is not None
    assert solvers.get_solver("statics_moment_arm") is not None
    # Exact registration is never shadowed by the generic fallback.
    assert solvers.get_solver("solve_max_friction") is solvers.SOLVER_REGISTRY["solve_max_friction"]
    # A genuinely unknown id still resolves to nothing.
    assert solvers.get_solver("totally_unknown_solver") is None


def test_resolve_assertion_stays_green_with_generic_dispatch():
    """assert_solver_ids_resolve must treat generic-resolvable ids as resolved."""
    solvers.assert_solver_ids_resolve(
        list(collect_referenced_solver_ids()) + ["dyn_newton_extra", "statics_moment_x"]
    )


# ---------------------------------------------------------------------------
# Richer formative feedback: a targeted hint for a WRONG numeric/step answer.
# ---------------------------------------------------------------------------

def test_wrong_numeric_answer_returns_targeted_hint():
    """A wrong answer graded through the solver path returns a step-derived hint
    that points at the first formula step without revealing the final value."""
    wrong = grading_service.grade_problem_with_solver(
        "solve_max_friction", {"mass_kg": 80, "mu_s": 0.35, "g": 9.81}, "100", "N"
    )
    assert wrong["is_correct"] is False
    hint = wrong.get("hint")
    assert hint, "wrong numeric answer should carry a targeted hint"
    assert "N = m*g" in hint  # the first worked step is surfaced
    assert "274" not in hint  # never reveal the final answer value
    assert "too low" in hint  # directional nudge (100 < ~274.7)


def test_correct_answer_has_no_hint():
    right = grading_service.grade_problem_with_solver(
        "solve_max_friction", {"mass_kg": 80, "mu_s": 0.35, "g": 9.81}, "274.7", "N"
    )
    assert right["is_correct"] is True
    assert right.get("hint") is None


def test_step_based_wrong_answer_returns_hint_from_steps():
    problem = {
        "type": "step_based",
        "final_answer": {"value": 84, "unit": "m", "tolerance": 0.5},
        "steps": [{"step_id": 1, "description": "v = v0 + at", "formula": "v = v0 + a*t"}],
    }
    result = grading_service.grade_problem(problem, "200", "m")
    assert result["is_correct"] is False
    assert result.get("hint")
    assert "v = v0 + a*t" in result["hint"]
    assert "too high" in result["hint"]  # 200 > 84


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
