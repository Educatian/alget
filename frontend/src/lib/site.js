/**
 * Per-site settings for the accounts build (one build per site, chosen by VITE_ID_PREFIX).
 * Features listed here are on for that site only; every other site keeps the shared behaviour.
 *
 *   ai-badge     a "✦ AI" pill on every generative AI touchpoint
 *   deadlines    chapter due dates in the course sidebar and the class roster
 *   analytics    the "Class analytics" tab on the instructor dashboard
 *   discussion   section discussions that update live
 */
import { ACCOUNTS_ENABLED, ID_PREFIX } from './account'

const SITES = {
    TAMU: {
        features: ['ai-badge', 'deadlines', 'analytics', 'discussion'],
        // LTPS 210: ALGET is introduced Thu Nov 5; Case Analysis 3 is due Sun Nov 15, 11:59 PM CT.
        chapterDue: {
            '01': '2026-11-08T23:59:00-06:00',
            '02': '2026-11-11T23:59:00-06:00',
            '03': '2026-11-13T23:59:00-06:00',
            '04': '2026-11-15T23:59:00-06:00',
        },
    },
    UTK: {
        features: ['discussion'],
        chapterDue: {},
    },
}

const SITE = SITES[ID_PREFIX] || { features: [], chapterDue: {} }

export const hasFeature = (name) => ACCOUNTS_ENABLED && SITE.features.includes(name)
export const CHAPTER_DUE = hasFeature('deadlines') ? SITE.chapterDue : {}
