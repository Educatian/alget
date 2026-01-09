# main_app.py - UA Intelligent Textbook (Premium UI)
"""
Modern, professional Streamlit application with keyword-based module generation.
Features glassmorphism, progress indicators, and premium aesthetics.
"""

import streamlit as st
import streamlit.components.v1 as components
from module_hooks import (
    get_all_modules,
    get_module_titles,
    get_hooks_for_module,
    get_module_info,
    get_keywords_for_hooks
)
from logic_engine import generate_module_content

# ============================================================================
# PAGE CONFIGURATION
# ============================================================================
st.set_page_config(
    page_title="UA Intelligent Textbook",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

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
    .main .block-container {
        padding: 1.5rem 2.5rem;
        max-width: 1200px;
    }
    
    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* ===== COLOR VARIABLES ===== */
    :root {
        --crimson: #9E1B32;
        --crimson-dark: #7A1527;
        --crimson-light: #C41E3A;
        --dark: #1a1a2e;
        --dark-secondary: #16213e;
        --gray-50: #fafafa;
        --gray-100: #f4f4f5;
        --gray-200: #e4e4e7;
        --gray-300: #d4d4d8;
        --gray-500: #71717a;
        --gray-700: #3f3f46;
        --gray-900: #18181b;
        --success: #10b981;
        --warning: #f59e0b;
    }
    
    /* ===== HERO SECTION ===== */
    .hero {
        background: linear-gradient(135deg, var(--crimson) 0%, var(--crimson-dark) 50%, var(--dark) 100%);
        padding: 2.5rem 2rem;
        border-radius: 24px;
        margin-bottom: 2rem;
        position: relative;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(158, 27, 50, 0.3);
    }
    
    .hero::before {
        content: "";
        position: absolute;
        top: -50%;
        right: -20%;
        width: 60%;
        height: 200%;
        background: radial-gradient(ellipse, rgba(255,255,255,0.1) 0%, transparent 70%);
        pointer-events: none;
    }
    
    .hero-content {
        position: relative;
        z-index: 1;
    }
    
    .hero-badge {
        display: inline-block;
        background: rgba(255,255,255,0.15);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 100px;
        font-size: 0.8rem;
        font-weight: 500;
        margin-bottom: 1rem;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
    }
    
    .hero-title {
        color: white;
        font-size: 2.25rem;
        font-weight: 800;
        letter-spacing: -1px;
        margin: 0 0 0.5rem 0;
        line-height: 1.2;
    }
    
    .hero-subtitle {
        color: rgba(255,255,255,0.8);
        font-size: 1rem;
        font-weight: 400;
        margin: 0;
    }
    
    /* ===== PROGRESS STEPPER ===== */
    .stepper {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0;
        margin: 2rem 0;
        padding: 1.5rem;
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    
    .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        position: relative;
    }
    
    .step-circle {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--gray-100);
        color: var(--gray-500);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 1.1rem;
        transition: all 0.3s ease;
        border: 2px solid var(--gray-200);
    }
    
    .step.active .step-circle {
        background: linear-gradient(135deg, var(--crimson) 0%, var(--crimson-dark) 100%);
        color: white;
        border-color: var(--crimson);
        box-shadow: 0 4px 14px rgba(158, 27, 50, 0.35);
    }
    
    .step.completed .step-circle {
        background: var(--success);
        color: white;
        border-color: var(--success);
    }
    
    .step-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--gray-500);
        text-align: center;
    }
    
    .step.active .step-label {
        color: var(--crimson);
        font-weight: 600;
    }
    
    .step-line {
        flex: 0.5;
        height: 2px;
        background: var(--gray-200);
        margin: 0 0.5rem;
    }
    
    .step-line.completed {
        background: var(--success);
    }
    
    /* ===== GLASS CARDS ===== */
    .glass-card {
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 20px;
        padding: 2rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
        transition: all 0.3s ease;
    }
    
    .glass-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
    }
    
    /* ===== SELECTION AREA ===== */
    .selection-container {
        background: linear-gradient(135deg, var(--gray-50) 0%, white 100%);
        border-radius: 20px;
        padding: 2rem;
        border: 1px solid var(--gray-200);
        margin-bottom: 1.5rem;
    }
    
    .selection-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--gray-900);
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .selection-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, var(--crimson) 0%, var(--crimson-dark) 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.25rem;
    }
    
    /* ===== CONTENT TABS ===== */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0.5rem;
        background: var(--gray-100);
        padding: 0.5rem;
        border-radius: 14px;
    }
    
    .stTabs [data-baseweb="tab"] {
        background: transparent;
        border-radius: 10px;
        padding: 0.75rem 1.25rem;
        font-weight: 500;
        font-size: 0.9rem;
        color: var(--gray-700);
        border: none;
    }
    
    .stTabs [aria-selected="true"] {
        background: white !important;
        color: var(--crimson) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    
    .stTabs [data-baseweb="tab-panel"] {
        padding-top: 1.5rem;
    }
    
    /* ===== CONTENT CARDS ===== */
    .content-card {
        background: white;
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid var(--gray-200);
        box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    
    .content-card-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--gray-100);
    }
    
    .content-card-icon {
        font-size: 1.5rem;
    }
    
    .content-card-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--gray-900);
        margin: 0;
    }
    
    /* ===== BUTTONS ===== */
    .stButton > button {
        background: linear-gradient(135deg, var(--crimson) 0%, var(--crimson-dark) 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 0.85rem 2rem;
        font-weight: 600;
        font-size: 1rem;
        transition: all 0.3s ease;
        box-shadow: 0 4px 14px rgba(158, 27, 50, 0.3);
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(158, 27, 50, 0.4);
    }
    
    /* ===== SIDEBAR ===== */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #fefefe 0%, #f8f8f9 100%);
    }
    
    [data-testid="stSidebar"] [data-testid="stVerticalBlock"] {
        padding: 1rem;
    }
    
    .sidebar-header {
        text-align: center;
        padding: 1.5rem 0;
        border-bottom: 1px solid var(--gray-200);
        margin-bottom: 1.5rem;
    }
    
    .sidebar-logo {
        font-size: 3rem;
        margin-bottom: 0.5rem;
    }
    
    .sidebar-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--gray-500);
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 1rem;
    }
    
    /* ===== INPUTS ===== */
    .stSelectbox > div > div,
    .stMultiSelect > div > div {
        border-radius: 12px !important;
        border: 2px solid var(--gray-200) !important;
    }
    
    .stSelectbox > div > div:focus-within,
    .stMultiSelect > div > div:focus-within {
        border-color: var(--crimson) !important;
        box-shadow: 0 0 0 3px rgba(158, 27, 50, 0.1) !important;
    }
    
    /* ===== QUIZ STYLING ===== */
    .quiz-question {
        background: var(--gray-50);
        padding: 1.25rem;
        border-radius: 12px;
        margin-bottom: 1rem;
        border-left: 4px solid var(--crimson);
    }
    
    .quiz-difficulty {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 0.75rem;
    }
    
    .quiz-difficulty.easy { background: #d1fae5; color: #059669; }
    .quiz-difficulty.medium { background: #fef3c7; color: #d97706; }
    .quiz-difficulty.challenging { background: #fee2e2; color: #dc2626; }
    
    /* ===== FOOTER ===== */
    .footer {
        text-align: center;
        padding: 2rem 1rem;
        color: var(--gray-500);
        font-size: 0.85rem;
        border-top: 1px solid var(--gray-200);
        margin-top: 3rem;
    }
    
    .footer-logo {
        font-weight: 700;
        color: var(--crimson);
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
        <div class="sidebar-logo">📚</div>
        <div style="font-weight: 700; font-size: 1.1rem; color: #1a1a2e;">UA Intelligent Textbook</div>
        <div style="font-size: 0.8rem; color: #71717a;">AI-Powered Learning</div>
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
        "Grade Level",
        ["Freshman", "Sophomore"],
        label_visibility="collapsed"
    )
    
    interest = st.selectbox(
        "Interest Area", 
        ["Sports", "Cars", "Manufacturing", "Architecture"],
        label_visibility="collapsed"
    )
    
    st.divider()
    
    # Navigation
    st.markdown('<div class="sidebar-title">🧭 Navigation</div>', unsafe_allow_html=True)
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

# Hero Section
st.markdown("""
<div class="hero">
    <div class="hero-content">
        <div class="hero-badge">🏈 University of Alabama</div>
        <h1 class="hero-title">Intelligent Textbook</h1>
        <p class="hero-subtitle">Select a module and topics to generate personalized learning content</p>
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
    tab1, tab2, tab3, tab4 = st.tabs(["💭 Narrative", "🧮 Activity", "🎮 Simulation", "🖼️ Illustration"])
    
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

# ============================================================================
# FOOTER
# ============================================================================
st.markdown("""
<div class="footer">
    <span class="footer-logo">UA Intelligent Textbook</span> • Powered by Google Gemini<br>
    Built with Richard Mayer's Multimedia Learning Principles • 🏈 Roll Tide!
</div>
""", unsafe_allow_html=True)
