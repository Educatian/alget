# module_hooks.py - Mechanical Engineering Module Hooks for Freshman/Sophomore
"""
Comprehensive list of ME course modules with learning hooks.
When PDF is loaded, these hooks connect to extracted content.
"""

# ============================================================================
# BIO-INSPIRED DESIGN MODULES
# ============================================================================
BIO_INSPIRED_MODULES = {
    "STRUCTURAL_BIOMIMICRY": {
        "title": "Structural Biomimicry",
        "icon": "🦴",
        "course_code": "BIO-ME 301",
        "description": "Translating natural load-bearing and material structures into engineering design",
        "hooks": [
            {"id": "cellular_solids", "name": "Cellular Solids", "keywords": ["honeycomb", "cancellous bone", "wood", "porous"]},
            {"id": "hierarchical_structures", "name": "Hierarchical Structures", "keywords": ["spider silk", "collagen", "nacre", "multi-scale"]},
            {"id": "directional_adhesion", "name": "Directional Adhesion", "keywords": ["gecko feet", "van der waals", "setae", "adhesion"]},
            {"id": "impact_resistance", "name": "Impact Resistance", "keywords": ["woodpecker skull", "pomelo peel", "shock absorption", "damping"]},
        ]
    },
    "LOCOMOTION_KINEMATICS": {
        "title": "Locomotion & Kinematics",
        "icon": "🦅",
        "course_code": "BIO-ME 302",
        "description": "Abstracting biological movement and fluid dynamics to mechanical systems",
        "hooks": [
            {"id": "fluid_dynamics", "name": "Biological Fluid Dynamics", "keywords": ["shark skin", "riblets", "drag reduction", "vortex shedding"]},
            {"id": "flapping_flight", "name": "Avian & Insect Flight", "keywords": ["flapping", "kingfisher beak", "aerodynamics", "lift"]},
            {"id": "terrestrial_gaits", "name": "Terrestrial Gaits", "keywords": ["cheetah spine", "hexapod", "walking", "kinematics"]},
            {"id": "soft_robotic_motion", "name": "Soft Body Locomotion", "keywords": ["octopus", "caterpillar", "peristalsis", "soft robotics"]},
        ]
    },
    "THERMOREGULATION": {
        "title": "Thermoregulation & Energy",
        "icon": "☀️",
        "course_code": "BIO-ME 303",
        "description": "Biological approaches to heat transfer, energy harvesting, and climate control",
        "hooks": [
            {"id": "passive_cooling", "name": "Passive Cooling", "keywords": ["termite mound", "ventilation", "thermal mass", "convection"]},
            {"id": "counter_current", "name": "Counter-Current Exchange", "keywords": ["penguin feet", "heat exchange", "gradient", "thermal recovery"]},
            {"id": "solar_harvesting", "name": "Solar Harvesting", "keywords": ["photosynthesis", "leaf morphology", "light trapping", "energy"]},
            {"id": "water_collection", "name": "Atmospheric Water Collection", "keywords": ["namib desert beetle", "hydrophilic", "hydrophobic", "condensation"]},
        ]
    },
    "SENSORY_SYSTEMS": {
        "title": "Sensory & Information Systems",
        "icon": "🦇",
        "course_code": "BIO-ME 304",
        "description": "Bio-analogues for sensors, signal processing, and navigation",
        "hooks": [
            {"id": "echolocation", "name": "Echolocation & Sonar", "keywords": ["bat", "dolphin", "acoustic", "sonar"]},
            {"id": "optical_sensors", "name": "Optical Systems", "keywords": ["compound eye", "moth eye", "anti-reflective", "vision"]},
            {"id": "chemoreception", "name": "Chemoreception", "keywords": ["olfactory", "chemical sensor", "sniffing", "detection"]},
            {"id": "swarm_logic", "name": "Swarm Intelligence", "keywords": ["ant colony", "flocking", "distributed control", "algorithm"]},
        ]
    }
}


# ============================================================================
# ACTIVITY TEMPLATES
# ============================================================================
ACTIVITY_TEMPLATES = {
    "biological_abstraction": {
        "icon": "🔬",
        "name": "Biological Abstraction",
        "template": "Identify the core functional mechanism in the {concept} found in nature. What is the active principle?"
    },
    "engineering_translation": {
        "icon": "⚙️",
        "name": "Engineering Translation",
        "template": "How can the biological principle of {concept} be abstracted into an engineering design to solve {problem_setup}?"
    },
    "comparison": {
        "icon": "⚖️",
        "name": "Compare & Contrast",
        "template": "Compare the biological structure of {concept} with a standard human engineering approach. How are they similar? Different?"
    },
    "application": {
        "icon": "🔗",
        "name": "Real-World Application",
        "template": "How would you apply {concept} to build a more sustainable or efficient product in the context of {ua_context}?"
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
    """Return all modules."""
    return {"Bio-Inspired Design": BIO_INSPIRED_MODULES}


def get_module_titles(grade_level: str = None) -> list:
    """
    Return list of module titles.
    Used for the module selection dropdown.
    """
    return [f"{mod['icon']} {mod['title']}" for mod in BIO_INSPIRED_MODULES.values()]


def get_hooks_for_module(module_display_name: str, grade_level: str = None) -> list:
    """
    Return hook names for the given module.
    Used for the keyword multiselect.
    
    Args:
        module_display_name: The display name with icon (e.g., "🦴 Structural Biomimicry")
        grade_level: Ignored in bio-inspired context
    """
    # Strip icon from display name
    title = module_display_name.split(" ", 1)[1] if " " in module_display_name else module_display_name
    
    for key, mod in BIO_INSPIRED_MODULES.items():
        if mod["title"] == title:
            return [hook["name"] for hook in mod["hooks"]]
    return []


def get_module_info(module_display_name: str, grade_level: str = None) -> dict:
    """
    Get full module information including description and all hooks.
    """
    title = module_display_name.split(" ", 1)[1] if " " in module_display_name else module_display_name
    
    for key, mod in BIO_INSPIRED_MODULES.items():
        if mod["title"] == title:
            return mod
    return None


def get_keywords_for_hooks(hook_names: list, module_display_name: str, grade_level: str = None) -> list:
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
    
    all_modules = BIO_INSPIRED_MODULES
    
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
