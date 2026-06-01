import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from './browserStorage'

export const EXIT_TICKET_MIN_CHARS = 120
export const EXIT_TICKET_STORAGE_PREFIX = 'alget_exit_ticket_v1_'
const EXIT_TICKET_INDEX_KEY = 'alget_exit_ticket_index_v1'
const EVIDENCE_PATTERN = /\b(evidence|because|example|annotation|data|result|shows|demonstrates|observed|source|quote)\b/i
const NEXT_MOVE_PATTERN = /\b(next|revise|apply|test|ask|practice|try|use|compare|improve|change|follow up)\b/i

export function getExitTicketStorageKey(sectionId) {
    return sectionId ? `${EXIT_TICKET_STORAGE_PREFIX}${sectionId}` : null
}

function parseSectionId(sectionId) {
    const [course = '', chapter = '', section = ''] = String(sectionId || '').split('/')
    return { course, chapter, section }
}

function readIndex() {
    const raw = safeLocalStorageGet(EXIT_TICKET_INDEX_KEY)
    if (!raw) return []

    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function writeIndex(entries) {
    safeLocalStorageSet(EXIT_TICKET_INDEX_KEY, JSON.stringify(entries))
}

function normalizeIndexEntry(entry) {
    if (!entry?.sectionId) return null
    const parsed = parseSectionId(entry.sectionId)

    return {
        sectionId: entry.sectionId,
        course: entry.course || parsed.course,
        chapter: entry.chapter || parsed.chapter,
        section: entry.section || parsed.section,
        title: entry.title || '',
        description: entry.description || '',
        updatedAt: entry.updatedAt || new Date().toISOString()
    }
}

function mergeIndexEntry(nextEntry) {
    const normalized = normalizeIndexEntry(nextEntry)
    if (!normalized) return

    const entries = readIndex()
        .map(normalizeIndexEntry)
        .filter(Boolean)
        .filter((entry) => entry.sectionId !== normalized.sectionId)

    writeIndex([normalized, ...entries].slice(0, 25))
}

export function readExitTicket(sectionId) {
    const key = getExitTicketStorageKey(sectionId)
    if (!key) return ''

    return safeLocalStorageGet(key) || ''
}

export function writeExitTicket(sectionId, value, metadata = {}) {
    const key = getExitTicketStorageKey(sectionId)
    if (!key) return

    const trimmed = String(value || '').trim()
    if (!trimmed) {
        safeLocalStorageRemove(key)
        return
    }

    safeLocalStorageSet(key, value)
    mergeIndexEntry({
        sectionId,
        ...metadata,
        updatedAt: new Date().toISOString()
    })
}

export function listExitTickets({ limit = 3 } = {}) {
    const indexed = readIndex()
        .map(normalizeIndexEntry)
        .filter(Boolean)
        .map((entry) => ({
            ...entry,
            text: readExitTicket(entry.sectionId).trim()
        }))
        .filter((entry) => entry.text)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())

    if (indexed.length >= limit || typeof window === 'undefined') {
        return indexed.slice(0, limit)
    }

    const known = new Set(indexed.map((entry) => entry.sectionId))
    const scanned = []

    try {
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index)
            if (!key?.startsWith(EXIT_TICKET_STORAGE_PREFIX)) continue

            const sectionId = key.slice(EXIT_TICKET_STORAGE_PREFIX.length)
            if (!sectionId || known.has(sectionId)) continue

            const text = readExitTicket(sectionId).trim()
            if (!text) continue

            const parsed = parseSectionId(sectionId)
            scanned.push({
                sectionId,
                ...parsed,
                title: '',
                description: '',
                updatedAt: '',
                text
            })
        }
    } catch {
        return indexed.slice(0, limit)
    }

    return [...indexed, ...scanned].slice(0, limit)
}

export function getExitTicketCue(ticketOrText) {
    const text = typeof ticketOrText === 'string'
        ? ticketOrText.trim()
        : String(ticketOrText?.text || '').trim()

    if (text.length < EXIT_TICKET_MIN_CHARS) {
        return {
            label: 'Strengthen trace',
            detail: 'Add claim, evidence, and a next move before relying on it.'
        }
    }

    if (!EVIDENCE_PATTERN.test(text)) {
        return {
            label: 'Add evidence',
            detail: 'Anchor the reflection in an example, result, annotation, or source.'
        }
    }

    if (!NEXT_MOVE_PATTERN.test(text)) {
        return {
            label: 'Name next move',
            detail: 'Turn the reflection into a revision, question, or practice action.'
        }
    }

    return {
        label: 'Reuse insight',
        detail: 'Connect this trace to your next artifact, quiz, or discussion.'
    }
}
