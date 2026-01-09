# backend/solvers/__init__.py
"""
Reference Solvers for Statics Problems

These solvers provide the correct answers for grading.
LLM is NOT used for answer calculation - only these deterministic solvers.
"""

from .statics_equilibrium import (
    solve_tension_inclined,
    solve_tension_vertical,
    solve_equilibrium_2d
)

__all__ = [
    'solve_tension_inclined',
    'solve_tension_vertical', 
    'solve_equilibrium_2d'
]
