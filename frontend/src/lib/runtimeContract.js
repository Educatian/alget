import API_BASE, { LLM_API_BASE } from './apiConfig'

/**
 * A response can be HTTP 200 and still be the Pages SPA shell.  Keeping this
 * error typed lets the reader distinguish a missing/invalid runtime contract
 * from a learner choosing a bad section.
 */
export class RuntimeContractError extends Error {
    constructor(message, { kind = 'runtime_error', status = null, url = null, cause = null } = {}) {
        super(message)
        this.name = 'RuntimeContractError'
        this.kind = kind
        this.status = status
        this.url = url
        this.cause = cause
    }
}

function joinUrl(base, path) {
    const normalizedBase = String(base || '').replace(/\/$/, '')
    const normalizedPath = String(path || '').replace(/^\//, '')
    return `${normalizedBase}/${normalizedPath}`
}

/**
 * Fetch and validate a JSON response from one of ALGET's runtime owners.
 * `validate` is deliberately a small shape predicate supplied by the caller;
 * it prevents HTML fallbacks and malformed generated payloads from entering
 * the reader state as if they were valid course data.
 */
export async function fetchRuntimeJson(base, path, {
    validate,
    label = 'runtime response',
    ...requestInit
} = {}) {
    const url = joinUrl(base, path)
    let response
    try {
        response = Object.keys(requestInit).length > 0
            ? await fetch(url, requestInit)
            : await fetch(url)
    } catch (cause) {
        throw new RuntimeContractError(`${label} is unavailable`, {
            kind: 'network_error',
            url,
            cause,
        })
    }

    if (!response.ok) {
        throw new RuntimeContractError(`${label} request failed (${response.status})`, {
            kind: 'http_error',
            status: response.status,
            url,
        })
    }

    const contentType = response.headers?.get?.('content-type') || ''
    if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw new RuntimeContractError(`${label} returned non-JSON content`, {
            kind: 'invalid_content_type',
            status: response.status,
            url,
        })
    }

    let payload
    try {
        payload = await response.json()
    } catch (cause) {
        throw new RuntimeContractError(`${label} returned invalid JSON`, {
            kind: 'invalid_json',
            status: response.status,
            url,
            cause,
        })
    }

    if (typeof validate === 'function' && !validate(payload)) {
        throw new RuntimeContractError(`${label} returned an invalid payload`, {
            kind: 'invalid_payload',
            status: response.status,
            url,
        })
    }

    return payload
}

export function fetchStaticJson(path, options = {}) {
    return fetchRuntimeJson(API_BASE, path, options)
}

export function fetchDynamicJson(path, options = {}) {
    return fetchRuntimeJson(LLM_API_BASE, path, options)
}

export function isTocPayload(value) {
    return Boolean(value && typeof value === 'object' && Array.isArray(value.chapters))
}

export function isSectionPayload(value) {
    return Boolean(
        value
        && typeof value === 'object'
        && value.meta
        && typeof value.meta === 'object'
        && (typeof value.content === 'string' || typeof value.raw === 'string'),
    )
}
