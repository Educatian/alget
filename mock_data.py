# mock_data.py - Concept Backgrounds and Test Data
"""
Hardcoded concept definitions and UA-contextualized examples for testing.
This data will be replaced by PDF-extracted content in the future.
"""

# ============================================================================
# CONCEPT BACKGROUNDS (for Landing Page)
# ============================================================================
CONCEPT_BACKGROUNDS = {
    "Thermodynamics": {
        "icon": "🔥",
        "title": "Thermodynamics",
        "tagline": "Energy in Motion",
        "description": """
        The study of heat, work, and energy transformations. From car engines
        to air conditioning, thermodynamics explains how energy flows and
        transforms in mechanical systems.
        """,
        "ua_context": "Alabama's hot, humid climate makes HVAC design critical. "
                     "Learn how thermodynamics powers the cooling systems in "
                     "Bryant-Denny Stadium's luxury suites.",
        "topics": ["Heat Transfer", "Entropy", "Carnot Cycles", "Refrigeration"]
    },
    "Statics": {
        "icon": "⚖️",
        "title": "Statics",
        "tagline": "Forces in Equilibrium",
        "description": """
        The analysis of systems at rest under applied forces. Statics is
        fundamental to designing bridges, buildings, and any structure that
        must remain stable under load.
        """,
        "ua_context": "The Black Warrior River bridges near campus demonstrate "
                     "static equilibrium. Every beam, cable, and support must "
                     "balance perfectly.",
        "topics": ["Free Body Diagrams", "Moments", "Trusses", "Friction"]
    },
    "Dynamics": {
        "icon": "🚀",
        "title": "Dynamics",
        "tagline": "Motion and Acceleration",
        "description": """
        The study of forces and motion. Dynamics explains how objects move,
        accelerate, and respond to forces—essential for designing vehicles,
        machines, and athletic equipment.
        """,
        "ua_context": "Alabama Football's biomechanics lab uses dynamics to "
                     "analyze player movements and optimize training programs "
                     "for peak performance.",
        "topics": ["Newton's Laws", "Momentum", "Energy Methods", "Vibrations"]
    },
    "Mechanics of Materials": {
        "icon": "🏗️",
        "title": "Mechanics of Materials",
        "tagline": "Stress, Strain & Strength",
        "description": """
        Understanding how materials deform and fail under loads. This
        knowledge ensures structures and machines are safe, efficient,
        and durable.
        """,
        "ua_context": "Bryant-Denny Stadium's massive cantilever upper decks "
                     "require precise stress analysis to support 100,000+ fans "
                     "safely.",
        "topics": ["Stress Analysis", "Beam Bending", "Torsion", "Failure Theories"]
    }
}

# ============================================================================
# MOCK TEXTBOOK DEFINITIONS (for Standard Tab)
# ============================================================================
MOCK_DEFINITIONS = {
    "thermodynamics": {
        "definition": """
**Thermodynamics** is the branch of physics that deals with the relationships
between heat, work, temperature, and energy.

**Key Laws:**
1. **Zeroth Law**: If A = B and B = C thermally, then A = C
2. **First Law**: Energy cannot be created or destroyed (ΔU = Q - W)
3. **Second Law**: Entropy of an isolated system always increases
4. **Third Law**: Entropy approaches zero as temperature approaches absolute zero

**Applications**: Heat engines, refrigerators, HVAC systems, power plants
        """,
        "keywords": ["heat", "energy", "entropy", "temperature", "work"]
    },
    "statics": {
        "definition": """
**Statics** is the study of forces acting on bodies at rest or in equilibrium.

**Equilibrium Conditions:**
- ΣF_x = 0 (sum of horizontal forces)
- ΣF_y = 0 (sum of vertical forces)  
- ΣM = 0 (sum of moments about any point)

**Key Concepts:**
- Free Body Diagrams (FBD)
- Support reactions
- Distributed loads
- Truss analysis

**Applications**: Bridges, buildings, cranes, mechanical assemblies
        """,
        "keywords": ["force", "equilibrium", "moment", "reaction", "load"]
    },
    "entropy": {
        "definition": """
**Entropy (S)** is a measure of disorder or randomness in a thermodynamic system.

**Mathematical Definition:**
dS = δQ_rev / T

**Key Principles:**
- Entropy always increases in irreversible processes
- At absolute zero, entropy of a perfect crystal is zero
- Entropy change determines process spontaneity

**Units**: J/(mol·K) or J/K

**Example**: Ice melting gains entropy as ordered molecules become disordered.
        """,
        "keywords": ["disorder", "reversible", "irreversible", "spontaneous"]
    },
    "torque": {
        "definition": """
**Torque (τ)** is the rotational equivalent of force, causing angular acceleration.

**Formula:**
τ = r × F = r·F·sin(θ)

**Key Concepts:**
- Moment arm (perpendicular distance from axis)
- Direction determined by right-hand rule
- Unit: Newton-meters (N·m)

**Applications**: 
- Engine crankshafts
- Wrench tightening bolts
- Electric motor output

**Example**: A longer wrench handle produces more torque with the same force.
        """,
        "keywords": ["rotation", "moment", "angular", "force", "lever"]
    },
    "momentum": {
        "definition": """
**Momentum (p)** is the quantity of motion possessed by a moving body.

**Linear Momentum:**
p = m·v (mass × velocity)

**Conservation Law:**
In isolated systems: Σp_before = Σp_after

**Impulse-Momentum Theorem:**
J = Δp = F·Δt

**Applications**:
- Collision analysis
- Rocket propulsion
- Sports physics (football tackles)
        """,
        "keywords": ["velocity", "mass", "collision", "impulse", "conservation"]
    }
}

# ============================================================================
# UA CONTEXT MAPPINGS
# ============================================================================
UA_CONTEXTS = {
    "thermodynamics": "AC systems battling Alabama's 95°F summer humidity",
    "statics": "Bridge loads spanning the Black Warrior River",
    "entropy": "Heat dissipation in Mercedes-Benz Vance's paint shop",
    "torque": "Alabama Football weight room training equipment",
    "momentum": "Tackling physics analyzed by UA's sports science lab"
}

def get_mock_definition(query: str) -> str:
    """Get mock textbook definition for a query."""
    query_lower = query.lower().strip()
    
    # Direct match
    if query_lower in MOCK_DEFINITIONS:
        return MOCK_DEFINITIONS[query_lower]["definition"]
    
    # Keyword search
    for concept, data in MOCK_DEFINITIONS.items():
        if any(kw in query_lower for kw in data["keywords"]):
            return f"*Related to {concept.title()}:*\n\n{data['definition']}"
    
    # No match - return placeholder
    return f"""
**[📘 PDF Not Connected]**

*Simulating textbook lookup for: "{query}"*

The Standard textbook module is currently using mock data. When PDF ingestion
is implemented, this section will display the relevant textbook content
extracted from your uploaded materials.

**Tip**: Try searching for: thermodynamics, statics, entropy, torque, or momentum.
    """

def get_all_concepts() -> dict:
    """Return all concept backgrounds for landing page."""
    return CONCEPT_BACKGROUNDS
