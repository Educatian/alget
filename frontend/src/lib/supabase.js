import { createClient } from '@supabase/supabase-js'

const e2eAuthBypass = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const supabaseUrl = e2eAuthBypass ? '' : (import.meta.env.VITE_SUPABASE_URL || '')
const supabaseAnonKey = e2eAuthBypass ? '' : (import.meta.env.VITE_SUPABASE_ANON_KEY || '')
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabaseConfig = { url: supabaseUrl, anonKey: supabaseAnonKey }

// Gracefully handle missing Supabase credentials (local dev without .env)
let supabase
if (isSupabaseConfigured) {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
    console.warn('[ALGET] Supabase credentials missing. Running in offline/demo mode.')
    // Provide a null-safe stub so the rest of the app doesn't crash
    const noOpResult = { data: null, error: { message: 'Supabase not configured' } }
    const noOp = async () => noOpResult

    supabase = {
        auth: {
            signUp: noOp,
            signInWithPassword: noOp,
            signOut: noOp,
            resetPasswordForEmail: noOp,
            getSession: async () => ({ data: { session: null } }),
            getUser: async () => ({ data: { user: null } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
        },
        channel: () => ({
            on() { return this },
            subscribe(callback) {
                callback?.('CLOSED')
                return this
            },
            track: noOp,
            send: noOp,
            presenceState: () => ({}),
            unsubscribe: noOp,
        }),
        removeChannel: noOp,
        from: () => {
            const chain = {
                insert: () => chain,
                select: () => chain,
                eq: () => chain,
                gte: () => chain,
                neq: () => chain,
                order: () => chain,
                upsert: () => chain,
                update: () => chain,
                delete: () => chain,
                in: () => chain,
                limit: () => chain,
                single: () => chain,
                maybeSingle: () => chain,
                then: (resolve) => resolve(noOpResult)
            };
            return chain;
        },
    }
}
export { supabase }

// Auth helpers
export async function signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
    })
    return { data, error }
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    return { data, error }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
}

export async function resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
}

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

// History tracking
export async function saveUserHistory(userId, historyData) {
    const { data, error } = await supabase
        .from('user_history')
        .insert([{ user_id: userId, ...historyData }])
    return { data, error }
}

export async function getUserHistory(userId) {
    const { data, error } = await supabase
        .from('user_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    return { data, error }
}
