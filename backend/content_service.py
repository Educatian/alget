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
    
    # Scan chapter directories (01, 02, etc.)
    for chapter_dir in sorted(course_path.iterdir()):
        if not chapter_dir.is_dir():
            continue
        
        chapter_id = chapter_dir.name
        sections = []
        chapter_title = f"Chapter {chapter_id}"
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
                        chapter_title = meta.get("chapter_title", chapter_title)
        
        if sections:
            chapters.append({
                "id": chapter_id,
                "title": chapter_title,
                "icon": chapter_icon,
                "sections": sections
            })
    
    return {
        "course": course,
        "title": course.title(),
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
