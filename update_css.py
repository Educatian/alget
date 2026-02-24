import re

with open('main_app.py', 'r', encoding='utf-8') as f:
    text = f.read()

new_css = """
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
"""

new_text = re.sub(r'<style>.*?</style>', f'<style>{new_css}</style>', text, flags=re.DOTALL)

with open('main_app.py', 'w', encoding='utf-8') as f:
    f.write(new_text)
