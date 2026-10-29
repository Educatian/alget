/**
 * Per-site features, keyed by the roster prefix (ID_PREFIX). The same code serves every site; a
 * feature listed here is on for that site only. Mirrors frontend/src/lib/site.js.
 */
import { idPrefix } from './accounts.js'

const SITE_FEATURES = {
    TAMU: ['analytics', 'discussion'],
    UTK: ['discussion'],
}

export const siteHas = (env, name) => (SITE_FEATURES[idPrefix(env)] || []).includes(name)
