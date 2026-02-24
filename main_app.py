# main_app.py - UA Intelligent Textbook (Premium UI)
"""
Modern, professional Streamlit application with keyword-based module generation.
Features glassmorphism, progress indicators, and premium aesthetics.
"""

import streamlit as st
import streamlit.components.v1 as components
import sys
import os

# Add backend directory to sys.path so we can import the Orchestrator
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
try:
    from agents.orchestrator import OrchestratorAgent
except ImportError:
    OrchestratorAgent = None

from module_hooks import (
    get_all_modules,
    get_module_titles,
    get_hooks_for_module,
    get_module_info,
    get_keywords_for_hooks
)
from logic_engine import generate_module_content
from backend.agents.evaluator_agent import EvaluatorAgent

# ============================================================================
# PAGE CONFIGURATION
# ============================================================================
# ============================================================================
st.set_page_config(
    page_title="Bio-Inspired Design Explorer",
    page_icon="🌿",
    layout="wide",
# ============================================================================
# DEPRECATION NOTICE
# ============================================================================
st.warning("⚠️ **DEPRECATED**: This standalone Streamlit interface has been deprecated. Please use the fully featured React frontend ('Generative Bio-Design Lab') running on localhost:5173.")
st.stop() # Prevent the rest of the app from running

# ============================================================================
# PREMIUM CSS STYLING
# ============================================================================
st.markdown("""
<style>
    /* ===== TYPOGRAPHY ===== */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    html, body, [class*="st-"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    /* ===== GLOBAL LAYOUT ===== */
    /* Background pattern for depth */
    .stApp {
        background-color: #f8fafc;
        background-image: radial-gradient(#cbd5e1 1px, transparent 0);
        background-size: 40px 40px;
    }

    .main .block-container {
        padding: 2rem 3rem;
        max-width: 1280px;
    }
    
    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* ===== COLOR VARIABLES (Antigravity Palette) ===== */
    :root {
        --ua-crimson: #9E1B32;
        --ua-crimson-dark: #7A1527;
        --ua-crimson-light: #C0223D;
        --slate-50: #f8fafc;
        --slate-100: #f1f5f9;
        --slate-200: #e2e8f0;
        --slate-700: #334155;
        --slate-800: #1e293b;
        --slate-900: #0f172a;
        --indigo-50: #eef2ff;
        --indigo-100: #e0e7ff;
        --success: #10b981;
        --warning: #f59e0b;
    }
    
    /* ===== GLASSMORPHISM UTILITIES ===== */
    .glass-panel {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        box-shadow: 0 10px 40px -10px rgba(15, 23, 42, 0.08);
        border-radius: 24px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .glass-panel:hover {
        box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.12);
        transform: translateY(-2px);
    }
    
    /* ===== HERO SECTION ===== */
    .hero {
        background: linear-gradient(135deg, var(--ua-crimson) 0%, var(--ua-crimson-dark) 100%);
        padding: 3rem 2.5rem;
        border-radius: 28px;
        margin-bottom: 2.5rem;
        position: relative;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(158, 27, 50, 0.35);
    }
    
    .hero::before {
        content: "";
        position: absolute;
        top: -50%;
        right: -20%;
        width: 60%;
        height: 200%;
        background: radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%);
        pointer-events: none;
    }
    
    .hero-content {
        position: relative;
        z-index: 1;
    }
    
    .hero-badge {
        display: inline-block;
        background: rgba(255, 255, 255, 0.15);
        color: white;
        padding: 0.5rem 1.25rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: 0.025em;
        margin-bottom: 1.25rem;
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .hero-title {
        color: white;
        font-size: 2.75rem;
        font-weight: 800;
        letter-spacing: -0.025em;
        margin: 0 0 0.75rem 0;
        line-height: 1.1;
        text-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .hero-subtitle {
        color: rgba(255, 255, 255, 0.9);
        font-size: 1.15rem;
        font-weight: 400;
        line-height: 1.6;
        margin: 0;
        max-width: 48rem;
    }
    
    /* ===== PROGRESS STEPPER ===== */
    .stepper {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0;
        margin: 2.5rem 0;
        padding: 1.5rem;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.5);
        border-radius: 24px;
        box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05);
    }
    
    .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
        position: relative;
    }
    
    .step-circle {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: white;
        color: var(--slate-500);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 1.25rem;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        border: 2px solid var(--slate-200);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    
    .step.active .step-circle {
        background: linear-gradient(135deg, var(--ua-crimson) 0%, var(--ua-crimson-dark) 100%);
        color: white;
        border-color: transparent;
        box-shadow: 0 10px 20px -5px rgba(158, 27, 50, 0.4);
        transform: scale(1.1);
    }
    
    .step.completed .step-circle {
        background: var(--slate-800);
        color: white;
        border-color: var(--slate-800);
    }
    
    .step-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--slate-500);
        text-align: center;
        transition: color 0.3s ease;
    }
    
    .step.active .step-label {
        color: var(--ua-crimson);
        font-weight: 700;
    }
    
    .step-line {
        flex: 0.5;
        height: 3px;
        background: var(--slate-200);
        margin: 0 1rem;
        border-radius: 99px;
        transition: background 0.4s ease;
    }
    
    .step-line.completed {
        background: var(--slate-800);
    }
    
    /* ===== SELECTION AREA ===== */
    .selection-container {
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(16px);
        border-radius: 24px;
        padding: 2.5rem;
        border: 1px solid rgba(255,255,255,0.6);
        margin-bottom: 2rem;
        box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.05);
    }
    
    .selection-title {
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--slate-900);
        margin-bottom: 1.75rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        letter-spacing: -0.025em;
    }
    
    .selection-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, var(--indigo-50) 0%, white 100%);
        border: 1px solid var(--indigo-100);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ua-crimson);
        font-size: 1.5rem;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    
    /* ===== CONTENT TABS ===== */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0.75rem;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(12px);
        padding: 0.75rem;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.4);
        box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
    }
    
    .stTabs [data-baseweb="tab"] {
        background: transparent;
        border-radius: 14px;
        padding: 0.85rem 1.5rem;
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--slate-600);
        border: none;
        transition: all 0.2s ease;
    }
    
    .stTabs [aria-selected="true"] {
        background: white !important;
        color: var(--ua-crimson) !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    
    .stTabs [data-baseweb="tab-panel"] {
        padding-top: 2rem;
    }
    
    /* ===== CONTENT CARDS ===== */
    .content-card {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        padding: 2rem;
        border: 1px solid rgba(255,255,255,0.8);
        box-shadow: 0 15px 35px -5px rgba(15, 23, 42, 0.05),
                    0 5px 15px -5px rgba(15, 23, 42, 0.03);
    }
    
    .content-card-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
        padding-bottom: 1.25rem;
        border-bottom: 2px solid var(--slate-100);
    }
    
    .content-card-icon {
        font-size: 1.75rem;
    }
    
    .content-card-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--slate-900);
        margin: 0;
        letter-spacing: -0.025em;
    }
    
    /* ===== BUTTONS ===== */
    .stButton > button {
        background: linear-gradient(135deg, var(--ua-crimson) 0%, var(--ua-crimson-dark) 100%);
        color: white;
        border: none;
        border-radius: 16px;
        padding: 1rem 2.5rem;
        font-weight: 600;
        font-size: 1.05rem;
        letter-spacing: 0.025em;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 10px 20px -5px rgba(158, 27, 50, 0.35);
    }
    
    .stButton > button:hover {
        transform: translateY(-3px);
        box-shadow: 0 15px 25px -5px rgba(158, 27, 50, 0.45);
    }
    
    /* ===== SIDEBAR ===== */
    [data-testid="stSidebar"] {
        background: var(--slate-50);
        border-right: 1px solid var(--slate-200);
    }
    
    [data-testid="stSidebar"] [data-testid="stVerticalBlock"] {
        padding: 1.5rem 1rem;
    }
    
    .sidebar-header {
        text-align: center;
        padding: 2rem 0;
        background: white;
        border-radius: 20px;
        border: 1px solid var(--slate-200);
        box-shadow: 0 4px 10px rgba(0,0,0,0.02);
        margin-bottom: 2rem;
    }
    
    .sidebar-logo {
        font-size: 3.5rem;
        margin-bottom: 0.75rem;
    }
    
    .sidebar-title {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--slate-500);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 1.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    /* ===== INPUTS ===== */
    .stSelectbox > div > div,
    .stMultiSelect > div > div,
    .stTextInput > div > div {
        border-radius: 16px !important;
        border: 2px solid var(--slate-200) !important;
        background: white !important;
        box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.02) !important;
        transition: all 0.2s ease !important;
    }
    
    .stSelectbox > div > div:focus-within,
    .stMultiSelect > div > div:focus-within,
    .stTextInput > div > div:focus-within {
        border-color: var(--ua-crimson) !important;
        box-shadow: 0 0 0 4px rgba(158, 27, 50, 0.1) !important;
    }
    
    /* ===== CHAT WIDGET STYLING ===== */
    .stChatMessage {
        background: transparent !important;
        border: none !important;
        padding: 1.5rem !important;
        border-radius: 20px !important;
        margin-bottom: 1rem !important;
    }

    [data-testid="chatAvatarIcon-user"] {
        background-color: var(--slate-800) !important;
    }
    
    [data-testid="chatAvatarIcon-assistant"] {
        background: linear-gradient(135deg, var(--ua-crimson) 0%, var(--ua-crimson-dark) 100%) !important;
    }

    /* Assistant Bubbles */
    .stChatMessage:has([data-testid="chatAvatarIcon-assistant"]) {
        background: rgba(255, 255, 255, 0.9) !important;
        backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(255,255,255,0.5) !important;
        box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.05) !important;
    }
    
    /* User Bubbles */
    .stChatMessage:has([data-testid="chatAvatarIcon-user"]) {
        background: var(--slate-100) !important;
    }
    
    /* Chat Input */
    .stChatInput {
        background: rgba(255, 255, 255, 0.8) !important;
        backdrop-filter: blur(16px) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.5) !important;
        padding-bottom: 2rem !important;
        padding-top: 1rem !important;
    }
    
    .stChatInput > div {
        border-radius: 24px !important;
        border: 2px solid var(--slate-200) !important;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05) !important;
    }

    /* ===== QUIZ STYLING ===== */
    .quiz-question {
        background: var(--slate-50);
        padding: 1.5rem;
        border-radius: 16px;
        margin-bottom: 1.25rem;
        border-left: 5px solid var(--ua-crimson);
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
    }
    
    .quiz-difficulty {
        display: inline-block;
        padding: 0.35rem 1rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 1rem;
    }
    
    .quiz-difficulty.easy { background: var(--indigo-50); color: #4338ca; }
    .quiz-difficulty.medium { background: #fef3c7; color: #d97706; }
    .quiz-difficulty.challenging { background: #fee2e2; color: #dc2626; }
    
    /* ===== FOOTER ===== */
    .footer {
        text-align: center;
        padding: 2.5rem 1rem;
        color: var(--slate-500);
        font-size: 0.9rem;
        font-weight: 500;
        border-top: 1px solid var(--slate-200);
        margin-top: 4rem;
        background: white;
        border-radius: 24px 24px 0 0;
    }
    
    .footer-logo {
        font-weight: 800;
        color: var(--ua-crimson);
        letter-spacing: -0.025em;
    }
</style>
""", unsafe_allow_html=True)

# ============================================================================
# SESSION STATE
# ============================================================================
if "page" not in st.session_state:
    st.session_state.page = "home"
if "selected_module" not in st.session_state:
    st.session_state.selected_module = None
if "selected_keywords" not in st.session_state:
    st.session_state.selected_keywords = []
if "generated_content" not in st.session_state:
    st.session_state.generated_content = None
if "current_step" not in st.session_state:
    st.session_state.current_step = 1

# ============================================================================
# SIDEBAR
# ============================================================================
with st.sidebar:
    st.markdown("""
    <div class="sidebar-header">
        <div class="sidebar-logo">🌿</div>
        <div style="font-weight: 700; font-size: 1.1rem; color: #1a1a2e;">Bio-Inspired Design Explorer</div>
        <div style="font-size: 0.8rem; color: #71717a;">Nature-Driven Engineering</div>
    </div>
    """, unsafe_allow_html=True)
    
    # API Configuration
    st.markdown('<div class="sidebar-title">🔑 API Configuration</div>', unsafe_allow_html=True)
    api_key = st.text_input(
        "Gemini API Key",
        type="password",
        help="Get free at aistudio.google.com",
        label_visibility="collapsed",
        placeholder="Enter your API key..."
    )
    
    st.divider()
    
    # Learning Profile
    st.markdown('<div class="sidebar-title">🎓 Learning Profile</div>', unsafe_allow_html=True)
    grade_level = st.selectbox(
        "Course Level",
        ["Undergraduate", "Graduate"],
        label_visibility="collapsed"
    )
    
    interest = st.selectbox(
        "Biological Domain", 
        ["Marine Ecosystems", "Avian/Flight", "Botany/Plant Life", "Entomology/Insects"],
        label_visibility="collapsed"
    )
    
    st.divider()
    
    # Navigation
    st.markdown('<div class="sidebar-title">🧭 Navigation</div>', unsafe_allow_html=True)
    app_mode = st.radio("App Mode", ["Module Explorer", "AI Orchestrator"], label_visibility="collapsed")
    if st.button("🏠 Start Over", use_container_width=True):
        st.session_state.page = "home"
        st.session_state.selected_module = None
        st.session_state.selected_keywords = []
        st.session_state.generated_content = None
        st.session_state.current_step = 1
        st.rerun()

# ============================================================================
# MAIN CONTENT
# ============================================================================

if app_mode == "AI Orchestrator":
    st.markdown("""
    <div class="hero">
        <div class="hero-content">
            <div class="hero-badge">🧠 Intelligent Routing</div>
            <h1 class="hero-title">AI Orchestrator</h1>
            <p class="hero-subtitle">Ask any question and let our specialized agents break it down</p>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    if "orchestrator_history" not in st.session_state:
        st.session_state.orchestrator_history = []
        
    def render_agent_result(result):
        intent = result.get("intent", "learn")
        if intent == "brainstorm":
            st.markdown("### 💡 Brainstorming Activity")
            act_data = result.get("activity_brainstorm", {}) if "activity_brainstorm" in result else result.get("activity", {})
            if isinstance(act_data, dict) and "activity_title" in act_data:
                st.subheader(act_data.get("activity_title", ""))
                st.write(act_data.get("lateral_thinking_prompt", ""))
                st.markdown("**Guiding Questions:**")
                for q in act_data.get("guiding_questions", []):
                    st.markdown(f"- {q}")
                st.info(f"**Wild Example:** {act_data.get('example_idea', '')}")
            else:
                st.write(act_data)
        elif intent == "evaluate":
            st.markdown("### 🧐 Expert Evaluation")
            eval_data = result.get("evaluation", {})
            if isinstance(eval_data, dict) and "score" in eval_data:
                st.markdown(f"**Score:** {eval_data.get('score', 0)}/10")
                st.write(eval_data.get("janine_feedback", ""))
                st.markdown("**Strengths:**")
                for s in eval_data.get("strengths", []):
                    st.markdown(f"- ✅ {s}")
                st.markdown("**Areas for Improvement:**")
                for a in eval_data.get("areas_for_improvement", []):
                    st.markdown(f"- 🔧 {a}")
            else:
                st.write(eval_data)
        elif intent == "illustrate":
            st.markdown("### 🎨 Visual Concept Design")
            ill_data = result.get("illustration", {})
            if isinstance(ill_data, dict) and "illustration_title" in ill_data:
                st.subheader(ill_data.get("illustration_title", ""))
                st.success(ill_data.get("conceptual_design", ""))
                
                if ill_data.get("image_prompt"):
                    st.markdown("**Image Generation Prompt:**")
                    st.code(ill_data.get("image_prompt"), language="markdown")
                
                if ill_data.get("ui_elements"):
                    st.markdown("**Key Diagram Elements:**")
                    for elem in ill_data.get("ui_elements", []):
                        st.markdown(f"- 🏷️ {elem}")
            else:
                st.write(ill_data)
        elif intent == "simulate":
            st.markdown("### 🕹️ Interactive Physics Simulation")
            sim_data = result.get("simulation", {})
            if isinstance(sim_data, dict) and "html_code" in sim_data:
                st.write(sim_data.get("description", ""))
                st.markdown("**Concepts Demonstrated:**")
                for c in sim_data.get("concepts_shown", []):
                    st.markdown(f"- 🔬 {c}")
                st.markdown("---")
                
                # Render the raw HTML simulation inside an iframe
                html_snippet = sim_data.get("html_code", "")
                if html_snippet:
                    components.html(html_snippet, height=600, scrolling=False)
            else:
                st.write(sim_data)
        elif intent == "help":
            st.markdown("### 💡 Guided Scaffolding")
            scaffolding_data = result.get("scaffolding", {})
            if isinstance(scaffolding_data, dict) and "encouragement" in scaffolding_data:
                st.info(scaffolding_data.get("encouragement", ""))
                st.markdown("**Let's break it down:**")
                st.write(scaffolding_data.get("simplified_explanation", ""))
                st.markdown("**Try answering this:**")
                st.write(scaffolding_data.get("guiding_question", ""))
            else:
                st.write(scaffolding_data)
        else:  # Default 'learn' mode
            tab1, tab2, tab3, tab4, tab5 = st.tabs(["📊 Final Summary", "🧬 Biology Agent", "⚙️ Engineering Agent", "✅ Validation & Critique", "💡 Brainstorming Activity"])
            
            summary_data = result.get("summary", {})
            bio_data = result.get("biology_context", {})
            eng_data = result.get("engineering_application", {})
            val_data = result.get("validation_critique", {})
            activity_data = result.get("activity_brainstorm", {})
            
            with tab1:
                st.markdown("### Synthesis")
                if isinstance(summary_data, dict) and "synthesis" in summary_data:
                    st.write(summary_data.get("synthesis", ""))
                    st.info(summary_data.get("encouragement", ""))
                    st.markdown("**Next Steps:**")
                    for step in summary_data.get("next_steps", []):
                        st.markdown(f"- {step}")
                else:
                    st.write(summary_data)

            with tab2:
                st.markdown("### Biological Mechanisms")
                if isinstance(bio_data, dict) and "primary_mechanism" in bio_data:
                    st.markdown(f"**Mechanism:** {bio_data.get('primary_mechanism', '')}")
                    st.write(bio_data.get("explanation", ""))
                    st.markdown("**Organisms:** " + ", ".join(bio_data.get("organism_examples", [])))
                    st.markdown("**Key Terms:** " + ", ".join(bio_data.get("key_terms", [])))
                else:
                    st.write(bio_data)

            with tab3:
                st.markdown("### Engineering Applications")
                if isinstance(eng_data, dict) and "engineering_principle" in eng_data:
                    st.markdown(f"**Principle:** {eng_data.get('engineering_principle', '')}")
                    st.write(eng_data.get("proposed_solution", ""))
                    st.markdown("**Applications:** " + ", ".join(eng_data.get("application_areas", [])))
                    st.markdown("**Challenges:**")
                    for c in eng_data.get("challenges", []):
                        st.markdown(f"- {c}")
                else:
                    st.write(eng_data)
                    
            with tab4:
                st.markdown("### Scientific Validation & Critique")
                if isinstance(val_data, dict) and "is_valid" in val_data:
                    validity_status = "✅ Valid Concept" if val_data.get("is_valid") else "❌ Needs Revision"
                    
                    iterations = result.get('iterations', 0)
                    if iterations > 0:
                        st.markdown(f"**Status:** {validity_status} (Score: {val_data.get('score', 0)}/10) - *Refined {iterations} time(s) via Debate Loop*")
                    else:
                        st.markdown(f"**Status:** {validity_status} (Score: {val_data.get('score', 0)}/10)")
                        
                    st.write(val_data.get("critique", ""))
                    
                    st.markdown("**Biological Fidelity:**")
                    st.info(val_data.get("biological_fidelity", ""))
                    
                    st.markdown("**Engineering Feasibility:**")
                    st.info(val_data.get("engineering_feasibility", ""))
                    
                    if val_data.get("suggestions"):
                        st.markdown("**Suggestions for Improvement:**")
                        for s in val_data.get("suggestions", []):
                            st.markdown(f"- {s}")
                else:
                    st.write(val_data)
                    
            with tab5:
                st.markdown("### Brainstorming & Ideation")
                if isinstance(activity_data, dict) and "activity_title" in activity_data:
                    st.markdown(f"#### {activity_data.get('activity_title', '')}")
                    st.markdown(f"*{activity_data.get('lateral_thinking_prompt', '')}*")
                    
                    st.markdown("**Guiding Questions:**")
                    for q in activity_data.get("guiding_questions", []):
                        st.markdown(f"- {q}")
                        
                    st.markdown("**Inspiration:**")
                    st.info(activity_data.get("example_idea", ""))
                elif "error" in activity_data:
                    st.error(activity_data.get("error"))
                else:
                    st.write(activity_data)

    # Render History
    for msg in st.session_state.orchestrator_history:
        with st.chat_message(msg["role"]):
            if msg["role"] == "user":
                st.markdown(msg["content"])
            else:
                if "result" in msg:
                    render_agent_result(msg["result"])
                else:
                    st.markdown(msg["content"])

    # Chat Input 
    if query := st.chat_input("Ask a question, propose a design, or brainstorm with the agents..."):
        if not api_key:
            st.error("Please enter a Gemini API Key in the sidebar.")
        else:
            # Render user query right away
            st.session_state.orchestrator_history.append({"role": "user", "content": query})
            with st.chat_message("user"):
                st.markdown(query)
                
            with st.chat_message("assistant"):
                with st.spinner("Orchestrator is delegating tasks to biology and engineering agents..."):
                    if OrchestratorAgent:
                        agent = OrchestratorAgent(api_key=api_key)
                        
                        # Use history up to the previous message 
                        history_payload = st.session_state.orchestrator_history[:-1]
                        result = agent.orchestrate(query, grade_level, interest, history=history_payload)
                        
                        if "error" in result and result.get("error") != "Gemini API key is required.":
                            st.error(result["error"])
                        else:
                            st.success(f"Analysis Complete! ({result.get('intent', 'learn').capitalize()} Mode)")
                            
                            # Render the massive result chunk natively
                            render_agent_result(result)
                            
                            # Add to state to persist
                            intent = result.get("intent", "learn")
                            if intent == "learn":
                                summary_text = result.get("summary", {}).get("synthesis", "Learn mode complete.") if isinstance(result.get("summary"), dict) else str(result.get("summary"))
                            elif intent == "brainstorm":
                                act_dict = result.get("activity_brainstorm", {}) if "activity_brainstorm" in result else result.get("activity", {})
                                summary_text = act_dict.get("activity_title", "Brainstorming complete.") if isinstance(act_dict, dict) else str(act_dict)
                            elif intent == "evaluate":
                                summary_text = result.get("evaluation", {}).get("janine_feedback", "Evaluation complete.") if isinstance(result.get("evaluation"), dict) else str(result.get("evaluation"))
                            elif intent == "illustrate":
                                ill_dict = result.get("illustration", {})
                                summary_text = ill_dict.get("illustration_title", "Illustration generated.") if isinstance(ill_dict, dict) else str(ill_dict)
                            elif intent == "simulate":
                                sim_dict = result.get("simulation", {})
                                summary_text = sim_dict.get("description", "Simulation generated.") if isinstance(sim_dict, dict) else str(sim_dict)
                            elif intent == "help":
                                scaf_dict = result.get("scaffolding", {})
                                summary_text = scaf_dict.get("encouragement", "Scaffolding provided.") if isinstance(scaf_dict, dict) else str(scaf_dict)
                            else:
                                summary_text = "Response generated."
                                
                            st.session_state.orchestrator_history.append({
                                "role": "assistant",
                                "content": summary_text,
                                "result": result
                            })
                    else:
                        st.error("Orchestrator Agent module not found.")
    
    st.markdown("""
    <div class="footer">
        <span class="footer-logo">Bio-Inspired Design Explorer</span> • AI Orchestrator<br>
        Applying Life's Principles to Engineering • 🌿 Nature Knows Best
    </div>
    """, unsafe_allow_html=True)
    st.stop()

# Hero Section
st.markdown("""
<div class="hero">
    <div class="hero-content">
        <div class="hero-badge">🧬 Life's Principles</div>
        <h1 class="hero-title">Bio-Inspired Design Explorer</h1>
        <p class="hero-subtitle">Select a natural mechanism to abstract and apply to engineering</p>
    </div>
</div>
""", unsafe_allow_html=True)

# Progress Stepper
step1_class = "completed" if st.session_state.current_step > 1 else ("active" if st.session_state.current_step == 1 else "")
step2_class = "completed" if st.session_state.current_step > 2 else ("active" if st.session_state.current_step == 2 else "")
step3_class = "active" if st.session_state.current_step == 3 else ""
line1_class = "completed" if st.session_state.current_step > 1 else ""
line2_class = "completed" if st.session_state.current_step > 2 else ""

st.markdown(f"""
<div class="stepper">
    <div class="step {step1_class}">
        <div class="step-circle">1</div>
        <div class="step-label">Select Module</div>
    </div>
    <div class="step-line {line1_class}"></div>
    <div class="step {step2_class}">
        <div class="step-circle">2</div>
        <div class="step-label">Choose Topics</div>
    </div>
    <div class="step-line {line2_class}"></div>
    <div class="step {step3_class}">
        <div class="step-circle">3</div>
        <div class="step-label">Learn</div>
    </div>
</div>
""", unsafe_allow_html=True)

# ============================================================================
# STEP 1 & 2: MODULE AND KEYWORD SELECTION
# ============================================================================
if st.session_state.current_step < 3:
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("""
        <div class="selection-container">
            <div class="selection-title">
                <div class="selection-icon">📖</div>
                <span>Select Module</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        module_titles = get_module_titles(grade_level)
        selected_module = st.selectbox(
            "Module",
            module_titles,
            label_visibility="collapsed",
            key="module_select"
        )
        st.session_state.selected_module = selected_module
        
        if selected_module:
            st.session_state.current_step = max(st.session_state.current_step, 2)
    
    with col2:
        st.markdown("""
        <div class="selection-container">
            <div class="selection-title">
                <div class="selection-icon">🏷️</div>
                <span>Choose Topics</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        if st.session_state.selected_module:
            hooks = get_hooks_for_module(st.session_state.selected_module, grade_level)
            selected_keywords = st.multiselect(
                "Topics",
                hooks,
                default=hooks[:2] if len(hooks) >= 2 else hooks,
                label_visibility="collapsed",
                key="keyword_select"
            )
            st.session_state.selected_keywords = selected_keywords
    
    # Generate Button
    st.markdown("<br>", unsafe_allow_html=True)
    
    col_left, col_center, col_right = st.columns([1, 2, 1])
    with col_center:
        if st.session_state.selected_module and st.session_state.selected_keywords:
            if st.button("🚀 Generate Learning Content", use_container_width=True, type="primary"):
                with st.spinner("✨ Generating personalized content..."):
                    content = generate_module_content(
                        module=st.session_state.selected_module,
                        keywords=st.session_state.selected_keywords,
                        grade_level=grade_level,
                        interest=interest,
                        api_key=api_key
                    )
                    st.session_state.generated_content = content
                    st.session_state.current_step = 3
                    st.rerun()
        else:
            st.info("👆 Select a module and at least one topic to continue")

# ============================================================================
# STEP 3: DISPLAY GENERATED CONTENT
# ============================================================================
if st.session_state.current_step == 3 and st.session_state.generated_content:
    content = st.session_state.generated_content
    
    # Content Tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs(["💭 Narrative", "🧮 Activity", "🎮 Simulation", "🖼️ Illustration", "💡 Expert Feedback"])
    
    # NARRATIVE TAB
    with tab1:
        narrative = content.get("narrative", {})
        st.markdown(f"""
        <div class="content-card">
            <div class="content-card-header">
                <span class="content-card-icon">📖</span>
                <h3 class="content-card-title">{narrative.get('title', 'Loading...')}</h3>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        story = narrative.get('story', 'No story generated.')
        st.markdown(story)
        
        if narrative.get('key_concepts'):
            st.markdown("---")
            st.markdown("**Key Concepts Covered:**")
            for concept in narrative.get('key_concepts', []):
                st.markdown(f"- {concept}")
    
    # ACTIVITY TAB
    with tab2:
        activity = content.get("activity", {})
        questions = activity.get("questions", [])
        
        st.markdown("""
        <div class="content-card">
            <div class="content-card-header">
                <span class="content-card-icon">📝</span>
                <h3 class="content-card-title">Practice Questions</h3>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        for i, q in enumerate(questions):
            difficulty = q.get('difficulty', 'medium').lower()
            
            st.markdown(f"""
            <div class="quiz-question">
                <span class="quiz-difficulty {difficulty}">{difficulty}</span>
                <p><strong>Q{i+1}:</strong> {q.get('question', 'Question not available')}</p>
            </div>
            """, unsafe_allow_html=True)
            
            options = q.get('options', [])
            if options:
                answer = st.radio(
                    f"Select your answer for Q{i+1}",
                    options,
                    key=f"q_{i}",
                    label_visibility="collapsed"
                )
                
                with st.expander("💡 Show Answer & Explanation"):
                    st.success(f"**Correct Answer:** {q.get('correct_answer', 'N/A')}")
                    st.info(q.get('explanation', 'No explanation available.'))
    
    # SIMULATION TAB
    with tab3:
        simulation = content.get("simulation", {})
        
        st.markdown("""
        <div class="content-card">
            <div class="content-card-header">
                <span class="content-card-icon">🔬</span>
                <h3 class="content-card-title">Interactive Simulation</h3>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown(f"*{simulation.get('description', 'Interactive visualization')}*")
        
        html_code = simulation.get('html_code', '<html><body><p>No simulation available</p></body></html>')
        components.html(html_code, height=500, scrolling=True)
    
    # ILLUSTRATION TAB
    with tab4:
        illustration = content.get("illustration", {})
        
        st.markdown("""
        <div class="content-card">
            <div class="content-card-header">
                <span class="content-card-icon">🎨</span>
                <h3 class="content-card-title">Concept Illustration</h3>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        st.info(f"**Illustration Description:**\n\n{illustration.get('description', 'Diagram would appear here')}")
        st.caption(f"*Image prompt: {illustration.get('prompt', 'N/A')}*")
        
    # EXPERT FEEDBACK TAB
    with tab5:
        st.markdown("""
        <div class="content-card">
            <div class="content-card-header">
                <span class="content-card-icon">🧠</span>
                <h3 class="content-card-title">Janine Benyus Evaluation</h3>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("Propose an engineering solution to receive critique from the persona of Janine Benyus.")
        
        with st.form("expert_feedback_form"):
            eng_problem = st.text_input("Engineering Problem", "e.g., Designing a more efficient wind turbine")
            student_proposal = st.text_area("Your Bio-Inspired Solution", "e.g., Implementing bumps on the leading edge of the blades inspired by humpback whale flippers.")
            
            submit_proposal = st.form_submit_button("Get Expert Critique")
            
        if submit_proposal:
            with st.spinner("Analyzing against Life's Principles..."):
                topic = ", ".join(st.session_state.selected_keywords)
                # Combine engineering problem and student proposal for the evaluator
                full_submission = f"Problem: {eng_problem}\nProposal: {student_proposal}"
                
                evaluator = EvaluatorAgent(api_key=api_key)
                feedback = evaluator.evaluate_design(full_submission, biological_context=topic)
                
                if "error" in feedback:
                    st.error(feedback["error"])
                else:
                    st.success(f"*{feedback.get('janine_feedback', '')}*")
                    
                    st.markdown(f"**Overall Score:** {feedback.get('score', 0)}/10")
                    
                    st.markdown("### Strengths")
                    for s in feedback.get('strengths', []):
                        st.markdown(f"- {s}")
                    
                    st.markdown("### Areas for Improvement")
                    for a in feedback.get('areas_for_improvement', []):
                        st.markdown(f"- {a}")

# ============================================================================
# FOOTER
# ============================================================================
st.markdown("""
<div class="footer">
    <span class="footer-logo">Bio-Inspired Design Explorer</span> • Powered by Google Gemini<br>
    Applying Life's Principles to Engineering • 🌿 Nature Knows Best
</div>
""", unsafe_allow_html=True)
