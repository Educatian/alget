import os
import json
import urllib.request
import urllib.error

# For local parsing
def load_env(env_path):
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r') as f:
        for line in f:
            if '=' in line:
                k, v = line.strip().split('=', 1)
                os.environ[k] = v

load_env('frontend/.env')

URL = os.environ.get('VITE_SUPABASE_URL')
KEY = os.environ.get('VITE_SUPABASE_ANON_KEY')

if not URL or not KEY:
    print("❌ Critical: Supabase URL or Anon Key not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env")
    exit(1)

HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
}

def upsert_table(table_name, payload):
    endpoint = f"{URL}/rest/v1/{table_name}?on_conflict=id"
    req = urllib.request.Request(endpoint, data=json.dumps(payload).encode('utf-8'), headers=HEADERS, method='POST')
    try:
        response = urllib.request.urlopen(req)
        print(f"✅ Upserted {len(payload)} rows into '{table_name}'")
    except urllib.error.URLError as e:
        print(f"❌ Error inserting into {table_name}:", e)
        if hasattr(e, 'read'): print("Detailed Error:", e.read().decode('utf-8'))

CONCEPTS = [
    # Bio-inspired Domain
    {'id': 'cellular_solids', 'name': 'Cellular Solids'},
    {'id': 'hierarchical_structures', 'name': 'Hierarchical Structures'},
    {'id': 'directional_adhesion', 'name': 'Directional Adhesion'},
    {'id': 'fluid_dynamics', 'name': 'Fluid Dynamics'},
    {'id': 'aeroacoustics', 'name': 'Aeroacoustics'},

    # Statics Domain
    {'id': 'vectors', 'name': 'Vectors'},
    {'id': 'equilibrium', 'name': 'Equilibrium'},
    {'id': 'trigonometry', 'name': 'Trigonometry'},
    {'id': 'moments', 'name': 'Moments (Torque)'},
    {'id': 'fbd', 'name': 'Free Body Diagrams'},
    {'id': 'friction', 'name': 'Friction'},
    {'id': 'units', 'name': 'Units of Measurement'},
    {'id': 'trusses', 'name': 'Trusses'},

    # Dynamics Domain
    {'id': 'kinematics', 'name': 'Kinematics'},

    # Instructional Design 
    {'id': 'ct_1_2', 'name': 'Cognitivism'},
    {'id': 'ct_2_1', 'name': 'Instructional Models (ADDIE)'},
    {'id': 'ct_1_3', 'name': 'Cognitive Load'},
    {'id': 'ct_2_2', 'name': 'Formative Evaluation'},
    {'id': 'ct_2_3', 'name': 'Summative Evaluation'},
    {'id': 'ct_1_1', 'name': 'Situated Learning & Context'}
]

QUESTIONS = [
    {"course_id": "bio-inspired", "concept_id": "cellular_solids", "stem": "Which of the following biological structures is an example of an open-cell porous solid used to maximize structural efficiency?", "options": ["Shark continuous dermal skin", "Turtle rigid shell", "Cancellous (spongy) bone", "Gecko foot spatulae"], "correct_index": 2, "prereq_for": ["01/01"]},
    {"course_id": "bio-inspired", "concept_id": "hierarchical_structures", "stem": "What is the primary mechanical advantage of combining stiff mineral platelets within a soft protein matrix (like in nacre)?", "options": ["It decreases the overall weight to zero.", "It provides extreme stiffness and high fracture toughness.", "It creates completely transparent layers.", "It prevents heat transfer completely."], "correct_index": 1, "prereq_for": ["01/02"]},
    {"course_id": "bio-inspired", "concept_id": "directional_adhesion", "stem": "Geckos cling to sheer surfaces primarily through:", "options": ["Sticky liquid mucous secretion", "Microscopic suction cups", "Van der Waals forces between billions of setae and the surface", "Electromagnetic charging of the glass"], "correct_index": 2, "prereq_for": ["01/03"]},
    {"course_id": "bio-inspired", "concept_id": "fluid_dynamics", "stem": "Riblets on shark skin reduce drag by:", "options": ["Coating the skin in a frictionless layer of oil", "Physically confining and lifting turbulent vortices away from valleys", "Preventing any water from touching the shark", "Increasing laminar flow perfectly across all curves"], "correct_index": 1, "prereq_for": ["02/01"]},
    {"course_id": "bio-inspired", "concept_id": "aeroacoustics", "stem": "Trailing edge serrations on an owl wing suppress flight noise by:", "options": ["Slowing down the bird dramatically", "Absorbing sound waves like a sponge", "Breaking large coherent vortices into smaller, high-frequency micro-turbulences", "Reflecting sound waves back upwards"], "correct_index": 2, "prereq_for": ["03/01"]},

    # Statics
    {"course_id": "statics", "concept_id": "vectors", "stem": "What is the x-component of a 100 N force acting at 60° from the horizontal?", "options": ["50 N", "86.6 N", "100 N", "70.7 N"], "correct_index": 0, "prereq_for": ["01/01", "01/02"]},
    {"course_id": "statics", "concept_id": "equilibrium", "stem": "For a particle in equilibrium, what is the sum of all forces?", "options": ["Maximum force", "Minimum force", "Zero", "Cannot be determined"], "correct_index": 2, "prereq_for": ["01/01"]},
    {"course_id": "statics", "concept_id": "trigonometry", "stem": "In a right triangle with angle θ = 30°, if the hypotenuse is 10, what is the opposite side?", "options": ["5", "8.66", "10", "7.07"], "correct_index": 0, "prereq_for": ["01/01", "02/01"]},

    # Dynamics
    {"course_id": "dynamics", "concept_id": "kinematics", "stem": "If velocity is constant, what is the acceleration?", "options": ["Equal to velocity", "Maximum", "Zero", "Cannot be determined"], "correct_index": 2, "prereq_for": ["01/01"]},

    # Inst-Design
    {"course_id": "inst-design", "concept_id": "ct_1_2", "stem": "Which learning theory focuses primarily on observable behaviors rather than internal mental states?", "options": ["Cognitivism", "Constructivism", "Behaviorism", "Connectivism"], "correct_index": 2, "prereq_for": ["01/03"]},
    {"course_id": "inst-design", "concept_id": "ct_2_1", "stem": "What does the acronym ADDIE stand for?", "options": ["Analyze, Design, Develop, Implement, Evaluate", "Assess, Draft, Deploy, Interact, Examine", "Acquire, Discuss, Discover, Internalize, Expand", "Align, Deliver, Design, Innovate, Educate"], "correct_index": 0, "prereq_for": ["02/01"]}
]

if __name__ == "__main__":
    print("--------------------------------------------------")
    print("📦 Bootstrapping Supabase Database (Concepts & Questions)")
    print("--------------------------------------------------")
    
    # 1. Upsert concepts
    upsert_table('concepts', CONCEPTS)
    
    # 2. Upsert Questions
    # Note: Ensure the "questions" table exists in your Supabase schema first!
    # Expected Questions Schema:
    #   create table questions (
    #       id uuid default uuid_generate_v4() primary key,
    #       course_id text,
    #       concept_id text references concepts(id),
    #       stem text,
    #       options jsonb,
    #       correct_index integer,
    #       prereq_for jsonb
    #   )
    upsert_table('questions', QUESTIONS)
    
    print("\n✅ Database seed completed.")
