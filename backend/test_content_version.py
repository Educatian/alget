"""Import-light tests for the content-version provenance hash.

Network-free and FastAPI-free: imports only content_service (a content-file
scan), so it runs in the same minimal environment as test_eval /
test_misconceptions / test_support_policy. Covers:

  * the hash is DETERMINISTIC (same section -> same digest across calls);
  * different sections yield different digests (it is a function of content);
  * canonicalization is order-independent for JSON substrates;
  * the slug helper is robust to missing / malformed section ids (-> None).
"""

import os
import sys

# Make backend modules importable regardless of pytest's rootdir.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from content_service import (  # noqa: E402
    CONTENT_VERSION_ALGORITHM,
    compute_content_version,
    content_version_for_section_id,
    _canonical_bytes,
)

# A real, populated section (mdx + meta + practice + misconceptions all exist).
_COURSE, _CHAPTER, _SECTION = "bio-inspired", "01", "01"
_SLUG = f"{_COURSE}/{_CHAPTER}/{_SECTION}"


def test_content_version_is_deterministic():
    first = compute_content_version(_COURSE, _CHAPTER, _SECTION)
    second = compute_content_version(_COURSE, _CHAPTER, _SECTION)
    assert first["content_version"] == second["content_version"]
    # sha256 hex digest shape.
    assert len(first["content_version"]) == 64
    assert all(c in "0123456789abcdef" for c in first["content_version"])
    assert first["algorithm"] == CONTENT_VERSION_ALGORITHM
    assert first["parts"] == ["mdx", "meta", "practice", "misconceptions"]


def test_content_version_via_slug_matches_direct():
    via_slug = content_version_for_section_id(_SLUG)
    direct = compute_content_version(_COURSE, _CHAPTER, _SECTION)
    assert via_slug is not None
    assert via_slug["content_version"] == direct["content_version"]


def test_different_sections_have_different_versions():
    a = compute_content_version(_COURSE, _CHAPTER, _SECTION)["content_version"]
    b = compute_content_version(_COURSE, _CHAPTER, "02")["content_version"]
    assert a != b


def test_missing_section_still_produces_a_digest():
    # No crash, and a stable digest for a wholly-absent section (all markers).
    one = compute_content_version("no-such-course", "99", "99")
    two = compute_content_version("no-such-course", "99", "99")
    assert one["content_version"] == two["content_version"]
    # ...and it is distinct from a real, populated section.
    assert one["content_version"] != compute_content_version(
        _COURSE, _CHAPTER, _SECTION
    )["content_version"]


def test_canonical_bytes_is_key_order_independent():
    # Two dicts equal up to key order must canonicalize identically.
    assert _canonical_bytes({"a": 1, "b": 2}) == _canonical_bytes({"b": 2, "a": 1})
    # Absent substrate (None) is distinct from an empty dict/string.
    assert _canonical_bytes(None) != _canonical_bytes({})
    assert _canonical_bytes(None) != _canonical_bytes("")


def test_slug_helper_robust_to_bad_input():
    assert content_version_for_section_id(None) is None
    assert content_version_for_section_id("") is None
    assert content_version_for_section_id("only-one-part") is None
    assert content_version_for_section_id("course/chapter") is None
    assert content_version_for_section_id("a//c") is None
