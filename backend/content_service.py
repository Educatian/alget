# backend/content_service.py - Content Loading Service
"""
Service for loading MDX content and metadata from the content folder.
"""

import os
import json
from pathlib import Path
from typing import Optional

# Content directory (relative to backend)
CONTENT_DIR = Path(__file__).parent.parent / "frontend" / "content"

KNOWN_CHAPTER_TITLES = {
    "bio-inspired": {
        "01": "Structural Biomimicry",
        "02": "Locomotion & Kinematics",
        "03": "Thermoregulation",
        "04": "Dry Adhesion and Contact Mechanics",
        "05": "Structural Color and Optical Surfaces",
        "06": "Thermal Regulation and Environmental Control",
        "07": "Resilience and Material Repair",
        "08": "Swarm Intelligence and Distributed Systems"
    },
    "ai-ethics": {
        "01": "Foundations of AI Ethics",
        "02": "Bias and Fairness",
        "03": "Transparency and Accountability",
        "04": "Privacy, Consent, and Data Governance",
        "05": "Safety, Alignment, and Governance",
        "06": "AI in Education Ethics"
    },
    "ail606-supplement": {
        "01": "Foundations of Interactive Multimedia Learning",
        "02": "Learning Experience Design and Software Technology",
        "03": "Multimedia Storyboarding and AI Asset Generation",
        "04": "Design Draft and Theory-to-Prototype Alignment",
        "05": "Usability Testing and Learning Evidence",
        "06": "Refined Prototype and Capstone Defense",
        "07": "Research Translation for Learning Design",
        "08": "Instructor Implementation Toolkit"
    },
    "cat531-supplement": {
        "01": "Foundations of CBI and Design Tensions",
        "02": "Teaching in Tech-Rich Classrooms With TeachGen@i",
        "03": "AI in Education",
        "04": "AI Ethics and Ethobot 3.2",
        "05": "Educational Technology Evaluation",
        "06": "Final Project and Professional Vision",
        "07": "Field-Based Transfer and Coaching",
        "08": "Instructor Toolkit for CAT 531"
    },
    "cat100-supplement": {
        "01": "Digital Citizenship and AI Readiness",
        "02": "Resume, Branding, and AI Brainstorming",
        "03": "Data Storytelling With Excel",
        "04": "AI Conversations as a Teacher",
        "05": "AI-Enhanced Presentation Development",
        "06": "GitHub Pages Personal Website",
        "07": "Productivity and Workflow Automation",
        "08": "Course Completion and Transfer"
    }
}

KNOWN_COURSE_TITLES = {
    "statics": "Engineering Statics",
    "dynamics": "ME 201: Engineering Dynamics",
    "bio-inspired": "Bio-Inspired Design",
    "inst-design": "Foundations of Instructional Design",
    "ai-ethics": "AI and Ethics",
    "ail606-supplement": "AIL 606: Software Technology Supplement",
    "cat531-supplement": "CAT 531: Technology and Teaching Supplement",
    "cat100-supplement": "CAT 100: Computer Concepts and Applications Supplement",
}


def get_content_path(course: str, chapter: str, section: str) -> Path:
    """Get the path to content files for a section."""
    return CONTENT_DIR / course / chapter


def load_section_meta(course: str, chapter: str, section: str) -> Optional[dict]:
    """Load metadata for a section."""
    meta_path = get_content_path(course, chapter, section) / f"{section}.meta.json"
    
    if not meta_path.exists():
        return None
    
    with open(meta_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_section_content(course: str, chapter: str, section: str) -> Optional[str]:
    """Load MDX content for a section."""
    # Try .mdx first, then .md
    content_path = get_content_path(course, chapter, section)
    
    for ext in ['.mdx', '.md']:
        file_path = content_path / f"{section}{ext}"
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
    
    return None


def load_section(course: str, chapter: str, section: str) -> dict:
    """
    Load complete section data (metadata + content).
    
    Returns:
        Dict with meta, content, simulation, illustration, practice keys
    """
    meta = load_section_meta(course, chapter, section)
    content = load_section_content(course, chapter, section)
    
    if not meta and not content:
        return {
            "error": "Section not found",
            "meta": None,
            "content": None
        }
    
    # Include course/chapter/section in meta
    if meta:
        meta["course"] = course
        meta["chapter"] = chapter
        meta["section"] = section
    
    return {
        "meta": meta or {
            "title": f"Section {chapter}.{section}",
            "course": course,
            "chapter": chapter,
            "section": section
        },
        "content": content or "*Content not available*",
        "simulation": None,  # Will be loaded separately if exists
        "illustration": None,
        "practice": load_practice_for_section(course, chapter, section)
    }


def load_practice_for_section(course: str, chapter: str, section: str) -> dict:
    """Load practice problems for a section."""
    practice_path = get_content_path(course, chapter, section) / f"{section}.practice.json"

    if practice_path.exists():
        with open(practice_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    return {"problems": []}


# In-memory cache for parsed misconception files, keyed by section slug.
# Mirrors the lightweight loading pattern used for practice problems so the
# authored *.misconceptions.json substrate reaches the grade/feedback loop
# without a per-request disk read.
_MISCONCEPTIONS_CACHE: dict[str, dict] = {}


def load_misconceptions(course: str, chapter: str, section: str) -> dict:
    """Load and cache the authored misconceptions for a section.

    Returns a normalized object shape:
        {"section_id": <str>, "misconceptions": [ {...}, ... ]}

    Handles the canonical object shape {section_id, misconceptions:[...]} and,
    defensively, the legacy bare-array shape (Phase 1 normalized the 2
    list-shaped files, but a tolerant reader keeps any stragglers from
    breaking the grade path). Always returns a dict; an empty list of
    misconceptions when the file is missing or unparseable. All I/O utf-8.
    """
    cache_key = f"{course}/{chapter}/{section}"
    cached = _MISCONCEPTIONS_CACHE.get(cache_key)
    if cached is not None:
        return cached

    path = get_content_path(course, chapter, section) / f"{section}.misconceptions.json"
    result = {"section_id": "", "misconceptions": []}

    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            data = None

        if isinstance(data, dict):
            result = {
                "section_id": data.get("section_id", ""),
                "misconceptions": data.get("misconceptions") or [],
            }
        elif isinstance(data, list):
            # Legacy bare-array shape: items are the misconceptions directly.
            result = {"section_id": "", "misconceptions": data}

    _MISCONCEPTIONS_CACHE[cache_key] = result
    return result


def find_misconception(course: str, chapter: str, section: str, misconception_id: str) -> Optional[dict]:
    """Look up a single misconception entry by id within a section.

    Returns the matching misconception dict (carrying pattern/feedback/
    rail_action/etc.) or None when the id is absent. Robust to a missing
    misconception_id (returns None) so the grade path never regresses.
    """
    if not misconception_id:
        return None
    data = load_misconceptions(course, chapter, section)
    for entry in data.get("misconceptions", []):
        if isinstance(entry, dict) and entry.get("id") == misconception_id:
            return entry
    return None


def collect_referenced_solver_ids() -> set:
    """Scan every *.practice.json under the content tree and collect the set of
    solver_id values referenced by problems.

    Used by the startup/CI assertion that guarantees every content solver_id
    resolves in the solver registry (so a problem can never silently fall
    through to a wrong grader).
    """
    referenced: set = set()
    if not CONTENT_DIR.exists():
        return referenced

    for practice_path in CONTENT_DIR.rglob("*.practice.json"):
        try:
            with open(practice_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        for problem in data.get("problems", []):
            solver_id = problem.get("solver_id")
            if solver_id:
                referenced.add(solver_id)

    return referenced


def assert_content_solver_ids_resolve() -> None:
    """Assert every referenced solver_id resolves in the registry.

    Raises AssertionError listing any unresolved ids. Safe to call at startup;
    if the solvers package cannot be imported the check is skipped (the app
    still boots) but the failure is surfaced to the caller via the raised
    ImportError only when invoked directly in CI.
    """
    import solvers as solver_registry

    solver_registry.assert_solver_ids_resolve(collect_referenced_solver_ids())


def generate_toc(course: str) -> dict:
    """
    Generate table of contents from content folder structure.
    
    Scans the content/{course}/ directory for chapters and sections.
    """
    course_path = CONTENT_DIR / course
    
    if not course_path.exists():
        return {
            "course": course,
            "title": course.title(),
            "chapters": []
        }
    
    chapters = []
    course_chapter_titles = KNOWN_CHAPTER_TITLES.get(course, {})
    
    # Scan chapter directories (01, 02, etc.)
    for chapter_dir in sorted(course_path.iterdir()):
        if not chapter_dir.is_dir():
            continue
        
        chapter_id = chapter_dir.name
        sections = []
        chapter_title = course_chapter_titles.get(chapter_id, f"Chapter {chapter_id}")
        chapter_icon = "📘"
        
        # Scan section files
        for file in sorted(chapter_dir.iterdir()):
            if file.name.endswith('.meta.json'):
                section_id = file.name.replace('.meta.json', '')
                meta = load_section_meta(course, chapter_id, section_id)
                
                if meta:
                    sections.append({
                        "id": section_id,
                        "title": meta.get("title", f"Section {section_id}")
                    })
                    
                    # Use first section's meta for chapter info if available
                    if section_id == "01":
                        chapter_title = meta.get("chapter_title") or course_chapter_titles.get(chapter_id, chapter_title)
        
        if sections:
            chapters.append({
                "id": chapter_id,
                "title": chapter_title,
                "icon": chapter_icon,
                "sections": sections
            })
        elif chapter_id in course_chapter_titles:
            # Surface KNOWN_CHAPTER_TITLES entries that have no .meta.json yet
            # as placeholders so the frontend can render "coming soon" instead
            # of silently hiding the planned chapter. No-op for currently-populated
            # chapters; future-proof for staged content rollouts.
            chapters.append({
                "id": chapter_id,
                "title": chapter_title,
                "icon": chapter_icon,
                "sections": [],
                "placeholder": True,
            })
    
    return {
        "course": course,
        "title": KNOWN_COURSE_TITLES.get(course, course.title()),
        "chapters": chapters
    }


# Fallback TOC for when content doesn't exist yet
def get_fallback_toc(course: str) -> dict:
    """Get fallback TOC structure for development."""
    
    if course == "bio-inspired": # Default fallback to bio-inspired design
        return {
            "course": "bio-inspired",
            "title": "Bio-Inspired Design",
            "chapters": [
                {
                    "id": "01",
                    "title": "Structural Biomimicry",
                    "icon": "🦴",
                    "sections": [
                        {"id": "01", "title": "Cellular Solids"},
                        {"id": "02", "title": "Hierarchical Structures"},
                        {"id": "03", "title": "Directional Adhesion"}
                    ]
                },
                {
                    "id": "02",
                    "title": "Locomotion & Kinematics",
                    "icon": "🦅",
                    "sections": [
                        {"id": "01", "title": "Fluid Dynamics"},
                        {"id": "02", "title": "Flapping Flight"},
                        {"id": "03", "title": "Soft Robotic Motion"}
                    ]
                },
                {
                    "id": "03",
                    "title": "Thermoregulation",
                    "icon": "☀️",
                    "sections": [
                        {"id": "01", "title": "Passive Cooling"},
                        {"id": "02", "title": "Thermal Exchange"},
                        {"id": "03", "title": "Solar Harvesting"}
                    ]
                }
            ]
        }
    
    elif course == "dynamics":
        return {
            "course": "dynamics",
            "title": "ME 201: Engineering Dynamics",
            "chapters": [
                {
                    "id": "01",
                    "title": "Foundational Kinematics",
                    "icon": "📐",
                    "sections": [
                        {"id": "01", "title": "Introduction to Dynamics"},
                        {"id": "02", "title": "Rigid Body Mechanics in Motion"},
                        {"id": "03", "title": "Newton-Euler Equations"}
                    ]
                },
                {
                    "id": "02",
                    "title": "Work and Energy",
                    "icon": "⚡",
                    "sections": [
                        {"id": "01", "title": "Work of a Force"},
                        {"id": "02", "title": "Conservation of Energy"},
                        {"id": "03", "title": "Power and Efficiency"}
                    ]
                }
            ]
        }
    
    elif course == "inst-design":
        return {
            "course": "inst-design",
            "title": "Instructional Design",
            "chapters": [
                {
                    "id": "01",
                    "title": "Learning Theories",
                    "icon": "🧠",
                    "sections": [
                        {"id": "01", "title": "Constructivism"},
                        {"id": "02", "title": "Cognitivism"},
                        {"id": "03", "title": "Behaviorism"}
                    ]
                },
                {
                    "id": "02",
                    "title": "Assessment & Evaluation",
                    "icon": "✏️",
                    "sections": [
                        {"id": "01", "title": "Formative vs Summative"},
                        {"id": "02", "title": "Rubric Design"},
                        {"id": "03", "title": "Feedback Models"}
                    ]
                }
            ]
        }
    
    return {
        "course": course,
        "title": course.title(),
        "chapters": []
    }
