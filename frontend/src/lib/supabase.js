import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Gracefully handle missing Supabase credentials (local dev without .env)
let supabase
if (supabaseUrl && supabaseAnonKey) {
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
        from: () => {
            const chain = {
                insert: () => chain,
                select: () => chain,
                eq: () => chain,
                neq: () => chain,
                order: () => chain,
                upsert: () => chain,
                delete: () => chain,
                in: () => chain,
                limit: () => chain,
                single: () => chain,
                then: (resolve) => resolve(noOpResult)
            };
            return chain;
        },
    }
}
export { supabase }

// Auth helpers
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
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
