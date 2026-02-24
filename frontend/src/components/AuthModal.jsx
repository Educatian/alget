import { useState } from 'react'
import { signIn, signUp, resetPassword } from '../lib/supabase'

export default function AuthModal({ isOpen, onClose, onSuccess }) {
    const [mode, setMode] = useState('signin') // signin, signup, forgot
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setMessage('')

        try {
            if (mode === 'signin') {
                const { data, error } = await signIn(email, password)
                if (error) throw error
                onSuccess(data.user)
            } else if (mode === 'signup') {
                const { data, error } = await signUp(email, password)
                if (error) throw error
                setMessage('Check your email for confirmation link!')
            } else if (mode === 'forgot') {
                const { error } = await resetPassword(email)
                if (error) throw error
                setMessage('Password reset email sent!')
            }
        } catch (err) {
            const errorMsg = err.message || 'An error occurred'
            // Provide more helpful error messages
            if (errorMsg.includes('Invalid login credentials')) {
                setError('Invalid email or password. Please try again or sign up.')
            } else if (errorMsg.includes('User already registered')) {
                setError('This email is already registered. Try signing in instead.')
            } else if (errorMsg.includes('Email not confirmed')) {
                setError('Please check your email and confirm your account first.')
            } else if (err.status === 422) {
                setError('Please enter a valid email address.')
            } else {
                setError(errorMsg)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative animate-fade-in">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
                >
                    ×
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="text-4xl mb-2">⚙️</div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {mode === 'signin' && 'Welcome Back'}
                        {mode === 'signup' && 'Create Account'}
                        {mode === 'forgot' && 'Reset Password'}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {mode === 'signin' && 'Sign in to continue learning'}
                        {mode === 'signup' && 'Start your engineering journey'}
                        {mode === 'forgot' && "We'll send you a reset link"}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#9E1B32] focus:ring-2 focus:ring-[#9E1B32]/20 outline-none text-gray-900 bg-white"
                            required
                        />
                    </div>

                    {mode !== 'forgot' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#9E1B32] focus:ring-2 focus:ring-[#9E1B32]/20 outline-none text-gray-900 bg-white"
                                required
                                minLength={6}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-lg text-sm">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-[#9E1B32] to-[#7A1527] text-white font-semibold py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : (
                            mode === 'signin' ? 'Sign In' :
                                mode === 'signup' ? 'Create Account' :
                                    'Send Reset Link'
                        )}
                    </button>
                </form>

                {/* Mode Switcher */}
                <div className="mt-6 text-center text-sm">
                    {mode === 'signin' && (
                        <div>
                            <span className="text-gray-500">Don't have an account? </span>
                            <button
                                onClick={() => setMode('signup')}
                                className="text-[#9E1B32] font-semibold hover:underline"
                            >
                                Sign Up
                            </button>
                        </div>
                    )}
                    {mode === 'signup' && (
                        <div>
                            <span className="text-gray-500">Already have an account? </span>
                            <button
                                onClick={() => setMode('signin')}
                                className="text-[#9E1B32] font-semibold hover:underline"
                            >
                                Sign In
                            </button>
                        </div>
                    )}
                    {mode === 'forgot' && (
                        <button
                            onClick={() => setMode('signin')}
                            className="text-[#9E1B32] font-semibold hover:underline"
                        >
                            ← Back to Sign In
                        </button>
                    )}
                </div>

                {/* Dev Bypass */}
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                    <button
                        onClick={() => onSuccess({ email: 'dev@test.com', id: '00000000-0000-0000-0000-000000000000' })}
                        className="text-xs text-gray-400 hover:text-gray-600"
                    >
                        Skip for Testing →
                    </button>
                </div>
            </div>
        </div>
    )
}
