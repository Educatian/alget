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

from . import dynamics_extra, friction, kinematics, statics_equilibrium, truss
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
    for module in (kinematics, friction, truss, dynamics_extra):
        registry.update(getattr(module, "SOLVERS", {}))
    # Legacy statics equilibrium solvers (statics_tension_vertical, etc.)
    registry.update(getattr(statics_equilibrium, "SOLVER_REGISTRY", {}))
    return registry


SOLVER_REGISTRY = _build_registry()

# Generic family dispatch table: a {family_prefix: solver} map consulted ONLY
# after an exact-id lookup misses. It lets a content solver_id that names a
# topic FAMILY (e.g. "dyn_newton_basic_numeric") resolve to a representative
# closed-form solver without a uniquely-named function per problem, while never
# shadowing an exactly-registered solver.
GENERIC_SOLVER_FAMILIES = dict(getattr(dynamics_extra, "GENERIC_SOLVER_FAMILIES", {}))


def _resolve_generic(solver_id: str):
    """Return a family solver whose prefix matches ``solver_id``, or None.

    Longest matching prefix wins so a more specific family is preferred. Used
    only as a fallback by ``get_solver`` after the exact registry misses.
    """
    if not solver_id:
        return None
    matches = [
        (prefix, solver)
        for prefix, solver in GENERIC_SOLVER_FAMILIES.items()
        if solver_id == prefix or solver_id.startswith(prefix + "_") or solver_id.startswith(prefix)
    ]
    if not matches:
        return None
    matches.sort(key=lambda item: len(item[0]), reverse=True)
    return matches[0][1]


def get_solver(solver_id: str):
    """Return the solver callable for ``solver_id``.

    Exact registry lookup first; on a miss, fall back to the generic family
    dispatch so a family-named solver_id still resolves. Returns None when
    neither resolves.
    """
    solver = SOLVER_REGISTRY.get(solver_id)
    if solver is not None:
        return solver
    return _resolve_generic(solver_id)


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
    unresolved = sorted({sid for sid in referenced_ids if get_solver(sid) is None})
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
