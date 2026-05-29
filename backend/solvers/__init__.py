# backend/solvers/__init__.py
"""
Reference Solvers for Statics & Dynamics Problems.

These solvers provide the correct answers for grading. The LLM is NOT used for
answer calculation, only these deterministic solvers.

This package exposes a single module-agnostic registry (``SOLVER_REGISTRY``)
that aggregates the solver functions defined across every solver module
(kinematics, friction, truss) plus the legacy statics-equilibrium solvers.
Use :func:`run_solver` / :func:`get_solver` / :func:`list_solver_ids` for
lookup, and :func:`assert_solver_ids_resolve` for a startup/CI guard.
"""

from . import friction, kinematics, statics_equilibrium, truss
from .statics_equilibrium import (
    solve_equilibrium_2d,
    solve_tension_inclined,
    solve_tension_vertical,
)


def _build_registry() -> dict:
    """Aggregate every module's SOLVERS map into one registry.

    Each solver module may expose a ``SOLVERS`` dict mapping the content-facing
    solver_id to its callable. The legacy statics_equilibrium module instead
    exposes ``SOLVER_REGISTRY`` (kept for backward compatibility), so we fold
    that in as well.
    """
    registry: dict = {}
    for module in (kinematics, friction, truss):
        registry.update(getattr(module, "SOLVERS", {}))
    # Legacy statics equilibrium solvers (statics_tension_vertical, etc.)
    registry.update(getattr(statics_equilibrium, "SOLVER_REGISTRY", {}))
    return registry


SOLVER_REGISTRY = _build_registry()


def get_solver(solver_id: str):
    """Return the solver callable for ``solver_id`` or None."""
    return SOLVER_REGISTRY.get(solver_id)


def list_solver_ids() -> list:
    """Return all registered solver ids."""
    return sorted(SOLVER_REGISTRY.keys())


def run_solver(solver_id: str, params: dict):
    """Run a solver with the given params dict. Returns the result or None."""
    solver = get_solver(solver_id)
    if solver is None:
        return None
    return solver(**(params or {}))


def assert_solver_ids_resolve(referenced_ids) -> None:
    """Raise AssertionError if any referenced solver_id is not in the registry.

    Intended as a startup/CI guard so a content solver_id can never silently
    fall through to a wrong grader.
    """
    unresolved = sorted({sid for sid in referenced_ids if sid not in SOLVER_REGISTRY})
    assert not unresolved, (
        f"Unresolved solver_id(s) referenced by content: {unresolved}. "
        f"Registered: {list_solver_ids()}"
    )


__all__ = [
    "SOLVER_REGISTRY",
    "get_solver",
    "list_solver_ids",
    "run_solver",
    "assert_solver_ids_resolve",
    "solve_tension_inclined",
    "solve_tension_vertical",
    "solve_equilibrium_2d",
]
