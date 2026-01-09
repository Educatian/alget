# module_hooks.py - Mechanical Engineering Module Hooks for Freshman/Sophomore
"""
Comprehensive list of ME course modules with learning hooks.
When PDF is loaded, these hooks connect to extracted content.
"""

# ============================================================================
# FRESHMAN YEAR MODULES
# ============================================================================
FRESHMAN_MODULES = {
    "INTRO_TO_ENGINEERING": {
        "title": "Introduction to Engineering",
        "icon": "🔧",
        "course_code": "ME 101",
        "description": "Overview of engineering professions and problem-solving approaches",
        "hooks": [
            {"id": "eng_design", "name": "Engineering Design Process", "keywords": ["design", "prototype", "iteration"]},
            {"id": "eng_ethics", "name": "Engineering Ethics", "keywords": ["ethics", "professional", "responsibility"]},
            {"id": "teamwork", "name": "Teamwork & Communication", "keywords": ["team", "collaboration", "present"]},
            {"id": "cad_basics", "name": "CAD Fundamentals", "keywords": ["cad", "drawing", "solidworks", "3d model"]},
        ]
    },
    "CALCULUS_1": {
        "title": "Calculus I",
        "icon": "📐",
        "course_code": "MATH 125",
        "description": "Limits, derivatives, and applications to engineering",
        "hooks": [
            {"id": "limits", "name": "Limits & Continuity", "keywords": ["limit", "continuous", "approach"]},
            {"id": "derivatives", "name": "Derivatives", "keywords": ["derivative", "rate of change", "slope", "differentiate"]},
            {"id": "optimization", "name": "Optimization Problems", "keywords": ["maximum", "minimum", "optimize", "critical point"]},
            {"id": "related_rates", "name": "Related Rates", "keywords": ["related rates", "rate", "changing"]},
        ]
    },
    "PHYSICS_1": {
        "title": "Physics I: Mechanics",
        "icon": "⚡",
        "course_code": "PH 101",
        "description": "Classical mechanics, motion, forces, and energy",
        "hooks": [
            {"id": "kinematics", "name": "Kinematics", "keywords": ["velocity", "acceleration", "motion", "displacement"]},
            {"id": "newtons_laws", "name": "Newton's Laws", "keywords": ["newton", "force", "F=ma", "inertia"]},
            {"id": "work_energy", "name": "Work & Energy", "keywords": ["work", "kinetic energy", "potential energy", "joule"]},
            {"id": "momentum", "name": "Momentum & Collisions", "keywords": ["momentum", "impulse", "collision", "conservation"]},
            {"id": "rotational", "name": "Rotational Motion", "keywords": ["rotation", "angular", "torque", "moment of inertia"]},
        ]
    },
    "CHEMISTRY": {
        "title": "General Chemistry",
        "icon": "🧪",
        "course_code": "CH 101",
        "description": "Chemical principles for engineers",
        "hooks": [
            {"id": "atomic_structure", "name": "Atomic Structure", "keywords": ["atom", "electron", "orbital", "element"]},
            {"id": "bonding", "name": "Chemical Bonding", "keywords": ["bond", "ionic", "covalent", "molecular"]},
            {"id": "thermochem", "name": "Thermochemistry", "keywords": ["enthalpy", "exothermic", "endothermic", "heat"]},
            {"id": "materials", "name": "Materials Chemistry", "keywords": ["metal", "polymer", "ceramic", "material"]},
        ]
    },
}

# ============================================================================
# SOPHOMORE YEAR MODULES
# ============================================================================
SOPHOMORE_MODULES = {
    "STATICS": {
        "title": "Statics",
        "icon": "⚖️",
        "course_code": "ME 270",
        "description": "Analysis of forces on bodies at rest",
        "hooks": [
            {"id": "fbd", "name": "Free Body Diagrams", "keywords": ["free body", "fbd", "diagram", "isolate"]},
            {"id": "equilibrium", "name": "Equilibrium Equations", "keywords": ["equilibrium", "sum of forces", "balance"]},
            {"id": "moments", "name": "Moments & Couples", "keywords": ["moment", "couple", "torque", "rotation"]},
            {"id": "trusses", "name": "Truss Analysis", "keywords": ["truss", "joint", "member", "tension", "compression"]},
            {"id": "friction", "name": "Friction", "keywords": ["friction", "coefficient", "slip", "static friction"]},
            {"id": "centroids", "name": "Centroids & Inertia", "keywords": ["centroid", "center of mass", "moment of inertia"]},
        ]
    },
    "DYNAMICS": {
        "title": "Dynamics",
        "icon": "🚀",
        "course_code": "ME 274",
        "description": "Motion of particles and rigid bodies",
        "hooks": [
            {"id": "particle_kin", "name": "Particle Kinematics", "keywords": ["position", "velocity", "acceleration", "path"]},
            {"id": "particle_dyn", "name": "Particle Dynamics", "keywords": ["newton", "equation of motion", "F=ma"]},
            {"id": "work_energy_dyn", "name": "Work-Energy Methods", "keywords": ["work", "kinetic", "potential", "conservation"]},
            {"id": "impulse_momentum", "name": "Impulse-Momentum", "keywords": ["impulse", "momentum", "impact"]},
            {"id": "rigid_body", "name": "Rigid Body Motion", "keywords": ["rigid body", "rotation", "translation"]},
            {"id": "vibrations", "name": "Vibrations Intro", "keywords": ["vibration", "oscillation", "frequency", "damping"]},
        ]
    },
    "THERMODYNAMICS": {
        "title": "Thermodynamics",
        "icon": "🔥",
        "course_code": "ME 200",
        "description": "Energy, heat, and work in systems",
        "hooks": [
            {"id": "properties", "name": "System Properties", "keywords": ["property", "state", "intensive", "extensive"]},
            {"id": "first_law", "name": "First Law", "keywords": ["first law", "energy balance", "conservation"]},
            {"id": "second_law", "name": "Second Law & Entropy", "keywords": ["second law", "entropy", "irreversible"]},
            {"id": "cycles", "name": "Power Cycles", "keywords": ["cycle", "carnot", "rankine", "otto", "diesel"]},
            {"id": "refrigeration", "name": "Refrigeration Cycles", "keywords": ["refrigeration", "heat pump", "cop"]},
            {"id": "psychrometrics", "name": "Psychrometrics", "keywords": ["humidity", "air conditioning", "moist air"]},
        ]
    },
    "MATERIALS": {
        "title": "Mechanics of Materials",
        "icon": "🏗️",
        "course_code": "ME 323",
        "description": "Stress, strain, and deformation",
        "hooks": [
            {"id": "stress_strain", "name": "Stress & Strain", "keywords": ["stress", "strain", "deformation"]},
            {"id": "axial", "name": "Axial Loading", "keywords": ["axial", "tension", "compression", "elongation"]},
            {"id": "torsion", "name": "Torsion", "keywords": ["torsion", "twist", "shear stress", "shaft"]},
            {"id": "bending", "name": "Beam Bending", "keywords": ["bending", "beam", "moment", "neutral axis"]},
            {"id": "combined", "name": "Combined Loading", "keywords": ["combined", "principal stress", "mohr"]},
            {"id": "failure", "name": "Failure Theories", "keywords": ["failure", "yield", "factor of safety"]},
        ]
    },
    "CALCULUS_2": {
        "title": "Calculus II",
        "icon": "📊",
        "course_code": "MATH 126",
        "description": "Integration and series",
        "hooks": [
            {"id": "integration", "name": "Integration Techniques", "keywords": ["integral", "integrate", "antiderivative"]},
            {"id": "applications", "name": "Applications of Integration", "keywords": ["area", "volume", "arc length"]},
            {"id": "sequences", "name": "Sequences & Series", "keywords": ["sequence", "series", "convergence"]},
            {"id": "diff_eq_intro", "name": "Differential Equations Intro", "keywords": ["differential equation", "ODE"]},
        ]
    },
}

# ============================================================================
# ACTIVITY TEMPLATES
# ============================================================================
ACTIVITY_TEMPLATES = {
    "conceptual": {
        "icon": "💭",
        "name": "Conceptual Question",
        "template": "Explain in your own words: {concept}. Give a real-world example from {ua_context}."
    },
    "calculation": {
        "icon": "🧮",
        "name": "Calculation Problem",
        "template": "Given the following scenario at {ua_context}: {problem_setup}. Calculate {target_variable}."
    },
    "diagram": {
        "icon": "✏️",
        "name": "Diagram Activity",
        "template": "Draw a {diagram_type} for the following situation: {situation}."
    },
    "comparison": {
        "icon": "⚖️",
        "name": "Compare & Contrast",
        "template": "Compare {concept_a} and {concept_b}. How are they similar? Different?"
    },
    "application": {
        "icon": "🔗",
        "name": "Real-World Application",
        "template": "How would you apply {concept} to solve a problem at {ua_context}?"
    },
}

# ============================================================================
# IMAGE GENERATION PROMPTS
# ============================================================================
IMAGE_PROMPTS = {
    "diagram": "Clean, simple educational diagram showing {concept}. Engineering style, labeled components, white background, professional technical illustration.",
    "scenario": "Illustration of {ua_context} demonstrating {concept}. University of Alabama campus, engineering context, clean modern style.",
    "formula": "Visual representation of the formula {formula} with labeled variables and units. Educational infographic style.",
    "process": "Step-by-step flowchart showing the process of {concept}. Engineering diagram style, numbered steps.",
}


def get_all_modules():
    """Return all modules organized by year."""
    return {
        "Freshman": FRESHMAN_MODULES,
        "Sophomore": SOPHOMORE_MODULES
    }


def get_module_titles(grade_level: str) -> list:
    """
    Return list of module titles for the given grade level.
    Used for the module selection dropdown.
    """
    modules = FRESHMAN_MODULES if grade_level == "Freshman" else SOPHOMORE_MODULES
    return [f"{mod['icon']} {mod['title']}" for mod in modules.values()]


def get_hooks_for_module(module_display_name: str, grade_level: str) -> list:
    """
    Return hook names for the given module.
    Used for the keyword multiselect.
    
    Args:
        module_display_name: The display name with icon (e.g., "🚀 Dynamics")
        grade_level: "Freshman" or "Sophomore"
    """
    # Strip icon from display name
    title = module_display_name.split(" ", 1)[1] if " " in module_display_name else module_display_name
    
    modules = FRESHMAN_MODULES if grade_level == "Freshman" else SOPHOMORE_MODULES
    
    for key, mod in modules.items():
        if mod["title"] == title:
            return [hook["name"] for hook in mod["hooks"]]
    return []


def get_module_info(module_display_name: str, grade_level: str) -> dict:
    """
    Get full module information including description and all hooks.
    """
    title = module_display_name.split(" ", 1)[1] if " " in module_display_name else module_display_name
    
    modules = FRESHMAN_MODULES if grade_level == "Freshman" else SOPHOMORE_MODULES
    
    for key, mod in modules.items():
        if mod["title"] == title:
            return mod
    return None


def get_keywords_for_hooks(hook_names: list, module_display_name: str, grade_level: str) -> list:
    """
    Get all keywords associated with selected hooks.
    Used for building Gemini prompts.
    """
    mod = get_module_info(module_display_name, grade_level)
    if not mod:
        return []
    
    keywords = []
    for hook in mod["hooks"]:
        if hook["name"] in hook_names:
            keywords.extend(hook["keywords"])
    return list(set(keywords))  # Remove duplicates


def find_matching_hooks(query: str, pdf_text: str = None):
    """
    Find module hooks that match the query or PDF content.
    
    Returns list of matching hook dictionaries with relevance scores.
    """
    query_lower = query.lower()
    matches = []
    
    all_modules = {**FRESHMAN_MODULES, **SOPHOMORE_MODULES}
    
    for module_key, module in all_modules.items():
        for hook in module["hooks"]:
            score = 0
            matched_keywords = []
            
            # Check hook name
            if hook["name"].lower() in query_lower or query_lower in hook["name"].lower():
                score += 10
            
            # Check keywords
            for kw in hook["keywords"]:
                if kw in query_lower:
                    score += 5
                    matched_keywords.append(kw)
                elif pdf_text and kw in pdf_text.lower():
                    score += 2
                    matched_keywords.append(kw + " (PDF)")
            
            if score > 0:
                matches.append({
                    "module": module["title"],
                    "course": module["course_code"],
                    "hook_id": hook["id"],
                    "hook_name": hook["name"],
                    "score": score,
                    "matched": matched_keywords,
                    "icon": module["icon"]
                })
    
    # Sort by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:5]  # Top 5 matches


def generate_activity(hook_id: str, concept: str, ua_context: str) -> dict:
    """Generate an activity based on the hook type."""
    import random
    
    activity_type = random.choice(list(ACTIVITY_TEMPLATES.keys()))
    template = ACTIVITY_TEMPLATES[activity_type]
    
    return {
        "type": activity_type,
        "icon": template["icon"],
        "name": template["name"],
        "prompt": template["template"].format(
            concept=concept,
            ua_context=ua_context,
            problem_setup="[scenario based on your PDF content]",
            target_variable="[relevant variable]",
            diagram_type="free body diagram" if "fbd" in hook_id else "schematic",
            situation=concept,
            concept_a=concept,
            concept_b="a related concept"
        )
    }


def get_image_prompt(concept: str, ua_context: str, prompt_type: str = "diagram") -> str:
    """Get an image generation prompt for a concept."""
    template = IMAGE_PROMPTS.get(prompt_type, IMAGE_PROMPTS["diagram"])
    return template.format(concept=concept, ua_context=ua_context, formula="[formula]")
