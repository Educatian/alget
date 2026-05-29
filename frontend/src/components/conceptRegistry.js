// Concept-registry resolver for the typed semantic content nodes.
//
// The canonical concept registry lives at frontend/content/_concepts/registry.json
// (authored + validated by scripts/validate_content.py). Vite imports JSON
// natively, so the semantic nodes resolve concept ids against the same source
// of truth the validator and metadata layer use, rather than re-listing
// concepts inline. This makes the registry load-bearing in the prose, not only
// in section metadata.
//
// Adopts PreTeXt's xml:id -> target resolution idea: a reference to a concept
// id resolves to a structured target (label + description + related ids) that
// the knowl-style ConceptRef can expand in place.
import registry from '../../content/_concepts/registry.json'

const CONCEPTS_BY_ID = new Map(
    (Array.isArray(registry?.concepts) ? registry.concepts : []).map((concept) => [concept.id, concept]),
)

/**
 * Resolve a concept id against the registry.
 * @param {string} conceptId canonical concept id (e.g. "cognitive_load")
 * @returns {{ id: string, label: string, description: string, courses: string[], related: string[] } | null}
 *   the concept record, or null when the id is unknown (a dangling reference).
 */
export function resolveConcept(conceptId) {
    if (!conceptId) return null
    return CONCEPTS_BY_ID.get(conceptId) || null
}

/**
 * @param {string} conceptId
 * @returns {boolean} whether the id resolves to a registered concept.
 */
export function isKnownConcept(conceptId) {
    return Boolean(conceptId) && CONCEPTS_BY_ID.has(conceptId)
}

/**
 * Human-readable label for a concept id, falling back to a de-slugged form of
 * the id itself when the concept is not registered (so a dangling reference
 * still renders readable text rather than a raw slug).
 * @param {string} conceptId
 * @returns {string}
 */
export function conceptLabel(conceptId) {
    const concept = resolveConcept(conceptId)
    if (concept?.label) return concept.label
    return String(conceptId || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
        .trim()
}
