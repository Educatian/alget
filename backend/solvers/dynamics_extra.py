# backend/solvers/dynamics_extra.py
"""
Reference Solvers for the remaining numeric Dynamics / Statics topics that
previously had no dedicated solver: Newton's second law, work-energy, linear
momentum / impulse, rotational kinematics & kinetics, and the moment of a
force. Each is a deterministic closed form returning the canonical result
envelope (expected_value / expected_unit / tolerance / steps) used by the
grading layer, and accepts exactly the ``params`` keys a practice.json givens
block would carry.

These give the grade path a recompute-from-givens reference for topics that
were previously answer-key-only, and they back the generic family dispatch in
``solvers.__init__`` (see ``GENERIC_SOLVER_FAMILIES``) so a content solver_id
that names a family ("dyn_newton_*", "dyn_work_energy_*", ...) resolves even
without a uniquely-named function per problem.
"""

import math
from typing import Any, Dict

G = 9.81  # m/s^2, default gravitational acceleration


def _envelope(value: float, unit: str, tolerance: float, steps: list) -> Dict[str, Any]:
    return {
        "expected_value": round(value, 4),
        "expected_unit": unit,
        "tolerance": tolerance,
        "steps": steps,
    }


def _step(idx: int, desc: str, formula: str, calc: str, value, unit) -> Dict[str, Any]:
    return {
        "step_index": idx,
        "description": desc,
        "formula": formula,
        "calculation": calc,
        "expected_value": round(value, 4) if isinstance(value, (int, float)) else value,
        "expected_unit": unit,
    }


# --- Newton's second law ----------------------------------------------------

def solve_newton_second_law(force_N: float, mass_kg: float) -> Dict[str, Any]:
    """Acceleration from the net force: a = F_net / m."""
    a = force_N / mass_kg
    return _envelope(
        a, "m/s^2", 0.1,
        [_step(1, "Newton's second law solved for acceleration", "a = F_net / m",
               f"a = {force_N} / {mass_kg} = {round(a, 4)} m/s^2", a, "m/s^2")],
    )


def solve_newton_incline(mass_kg: float, angle_deg: float, mu_k: float = 0.0, g: float = G) -> Dict[str, Any]:
    """Acceleration of a block sliding down an incline with kinetic friction.

    a = g*(sin(theta) - mu_k*cos(theta)).
    """
    theta = math.radians(angle_deg)
    a = g * (math.sin(theta) - mu_k * math.cos(theta))
    return _envelope(
        a, "m/s^2", 0.1,
        [
            _step(1, "Forces along the incline: m*a = m*g*sin(theta) - mu_k*m*g*cos(theta)",
                  "a = g*(sin(theta) - mu_k*cos(theta))",
                  f"a = {g}*(sin({angle_deg}) - {mu_k}*cos({angle_deg})) = {round(a, 4)} m/s^2",
                  a, "m/s^2"),
        ],
    )


# --- Work / energy ----------------------------------------------------------

def solve_kinetic_energy(mass_kg: float, v: float) -> Dict[str, Any]:
    """Translational kinetic energy: KE = 0.5*m*v^2."""
    ke = 0.5 * mass_kg * v ** 2
    return _envelope(
        ke, "J", 0.1,
        [_step(1, "Translational kinetic energy", "KE = 0.5*m*v^2",
               f"KE = 0.5*{mass_kg}*{v}^2 = {round(ke, 4)} J", ke, "J")],
    )


def solve_work_constant_force(force_N: float, distance_m: float, angle_deg: float = 0.0) -> Dict[str, Any]:
    """Work of a constant force: W = F*d*cos(theta)."""
    theta = math.radians(angle_deg)
    w = force_N * distance_m * math.cos(theta)
    return _envelope(
        w, "J", 0.1,
        [_step(1, "Work of a constant force", "W = F*d*cos(theta)",
               f"W = {force_N}*{distance_m}*cos({angle_deg}) = {round(w, 4)} J", w, "J")],
    )


def solve_work_energy_speed(mass_kg: float, work_J: float, v0: float = 0.0) -> Dict[str, Any]:
    """Final speed from the work-energy theorem: W = 0.5*m*(v^2 - v0^2)."""
    v_sq = v0 ** 2 + 2.0 * work_J / mass_kg
    v = math.sqrt(max(0.0, v_sq))
    return _envelope(
        v, "m/s", 0.1,
        [
            _step(1, "Work-energy theorem solved for final speed",
                  "v = sqrt(v0^2 + 2*W/m)",
                  f"v = sqrt({v0}^2 + 2*{work_J}/{mass_kg}) = {round(v, 4)} m/s", v, "m/s"),
        ],
    )


# --- Momentum / impulse -----------------------------------------------------

def solve_linear_momentum(mass_kg: float, v: float) -> Dict[str, Any]:
    """Linear momentum magnitude: p = m*v."""
    p = mass_kg * v
    return _envelope(
        p, "kg*m/s", 0.1,
        [_step(1, "Linear momentum", "p = m*v",
               f"p = {mass_kg}*{v} = {round(p, 4)} kg*m/s", p, "kg*m/s")],
    )


def solve_impulse(force_N: float, time_s: float) -> Dict[str, Any]:
    """Impulse of a constant force: J = F*t."""
    j = force_N * time_s
    return _envelope(
        j, "N*s", 0.1,
        [_step(1, "Impulse of a constant force", "J = F*t",
               f"J = {force_N}*{time_s} = {round(j, 4)} N*s", j, "N*s")],
    )


def solve_perfectly_inelastic_collision(m1: float, v1: float, m2: float, v2: float = 0.0) -> Dict[str, Any]:
    """Common velocity after a perfectly inelastic (stick-together) collision.

    Conservation of momentum: (m1+m2)*v = m1*v1 + m2*v2.
    """
    v = (m1 * v1 + m2 * v2) / (m1 + m2)
    return _envelope(
        v, "m/s", 0.1,
        [
            _step(1, "Conservation of linear momentum for a stick-together collision",
                  "v = (m1*v1 + m2*v2) / (m1 + m2)",
                  f"v = ({m1}*{v1} + {m2}*{v2}) / ({m1} + {m2}) = {round(v, 4)} m/s", v, "m/s"),
        ],
    )


# --- Rotational kinematics / kinetics ---------------------------------------

def solve_angular_velocity_from_rpm(rpm: float) -> Dict[str, Any]:
    """Angular velocity from rev/min: omega = rpm * 2*pi / 60."""
    omega = rpm * 2.0 * math.pi / 60.0
    return _envelope(
        omega, "rad/s", 0.1,
        [_step(1, "Convert rev/min to rad/s", "omega = rpm * 2*pi / 60",
               f"omega = {rpm} * 2*pi / 60 = {round(omega, 4)} rad/s", omega, "rad/s")],
    )


def solve_rim_speed(omega: float, radius_m: float) -> Dict[str, Any]:
    """Rim (tangential) speed: v = omega * r."""
    v = omega * radius_m
    return _envelope(
        v, "m/s", 0.1,
        [_step(1, "Tangential speed at the rim", "v = omega*r",
               f"v = {omega}*{radius_m} = {round(v, 4)} m/s", v, "m/s")],
    )


def solve_tangential_acceleration(alpha: float, radius_m: float) -> Dict[str, Any]:
    """Tangential acceleration: a_t = alpha * r."""
    a_t = alpha * radius_m
    return _envelope(
        a_t, "m/s^2", 0.1,
        [_step(1, "Tangential acceleration", "a_t = alpha*r",
               f"a_t = {alpha}*{radius_m} = {round(a_t, 4)} m/s^2", a_t, "m/s^2")],
    )


def solve_normal_acceleration(omega: float, radius_m: float) -> Dict[str, Any]:
    """Normal (centripetal) acceleration: a_n = omega^2 * r."""
    a_n = omega ** 2 * radius_m
    return _envelope(
        a_n, "m/s^2", 0.1,
        [_step(1, "Normal (centripetal) acceleration", "a_n = omega^2*r",
               f"a_n = {omega}^2*{radius_m} = {round(a_n, 4)} m/s^2", a_n, "m/s^2")],
    )


def solve_angular_acceleration(torque_Nm: float, inertia: float) -> Dict[str, Any]:
    """Angular acceleration from the rotational analogue of Newton's law.

    alpha = M / I.
    """
    alpha = torque_Nm / inertia
    return _envelope(
        alpha, "rad/s^2", 0.1,
        [_step(1, "Rotational form of Newton's second law", "alpha = M / I",
               f"alpha = {torque_Nm} / {inertia} = {round(alpha, 4)} rad/s^2", alpha, "rad/s^2")],
    )


def solve_rotational_kinetic_energy(inertia: float, omega: float) -> Dict[str, Any]:
    """Rotational kinetic energy: KE_rot = 0.5*I*omega^2."""
    ke = 0.5 * inertia * omega ** 2
    return _envelope(
        ke, "J", 0.1,
        [_step(1, "Rotational kinetic energy", "KE = 0.5*I*omega^2",
               f"KE = 0.5*{inertia}*{omega}^2 = {round(ke, 4)} J", ke, "J")],
    )


# --- Moment of a force ------------------------------------------------------

def solve_moment_perpendicular(force_N: float, distance_m: float) -> Dict[str, Any]:
    """Moment of a force whose line of action is perpendicular: M = F*d."""
    m = force_N * distance_m
    return _envelope(
        m, "N*m", 1.0,
        [_step(1, "Moment of a perpendicular force about the point", "M = F*d",
               f"M = {force_N}*{distance_m} = {round(m, 4)} N*m", m, "N*m")],
    )


def solve_moment_at_angle(force_N: float, distance_m: float, angle_deg: float) -> Dict[str, Any]:
    """Moment from the perpendicular component: M = F*d*sin(theta)."""
    theta = math.radians(angle_deg)
    m = force_N * distance_m * math.sin(theta)
    return _envelope(
        m, "N*m", 1.0,
        [_step(1, "Moment from the perpendicular force component", "M = F*d*sin(theta)",
               f"M = {force_N}*{distance_m}*sin({angle_deg}) = {round(m, 4)} N*m", m, "N*m")],
    )


SOLVERS = {
    # Newton's second law
    "solve_newton_second_law": solve_newton_second_law,
    "solve_newton_incline": solve_newton_incline,
    # Work / energy
    "solve_kinetic_energy": solve_kinetic_energy,
    "solve_work_constant_force": solve_work_constant_force,
    "solve_work_energy_speed": solve_work_energy_speed,
    # Momentum / impulse
    "solve_linear_momentum": solve_linear_momentum,
    "solve_impulse": solve_impulse,
    "solve_perfectly_inelastic_collision": solve_perfectly_inelastic_collision,
    # Rotational kinematics / kinetics
    "solve_angular_velocity_from_rpm": solve_angular_velocity_from_rpm,
    "solve_rim_speed": solve_rim_speed,
    "solve_tangential_acceleration": solve_tangential_acceleration,
    "solve_normal_acceleration": solve_normal_acceleration,
    "solve_angular_acceleration": solve_angular_acceleration,
    "solve_rotational_kinetic_energy": solve_rotational_kinetic_energy,
    # Moment of a force
    "solve_moment_perpendicular": solve_moment_perpendicular,
    "solve_moment_at_angle": solve_moment_at_angle,
}


# Generic family dispatch: maps a family prefix to a representative solver so a
# content solver_id that NAMES a family (rather than an exact function) still
# resolves. The dispatcher in solvers.__init__ consults this only after an
# exact-id lookup misses, so it never shadows a specific solver.
GENERIC_SOLVER_FAMILIES = {
    "dyn_newton": solve_newton_second_law,
    "dyn_work_energy": solve_work_energy_speed,
    "dyn_kinetic_energy": solve_kinetic_energy,
    "dyn_momentum": solve_linear_momentum,
    "dyn_impulse": solve_impulse,
    "dyn_rotational": solve_rotational_kinetic_energy,
    "statics_moment": solve_moment_perpendicular,
}
