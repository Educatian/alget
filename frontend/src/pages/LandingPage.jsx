import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GearAnimation from '../components/GearAnimation'
import AuthModal from '../components/AuthModal'
import GenerativeIllustration from '../components/GenerativeIllustration'

export default function LandingPage({ onLogin, user, onLogout }) {
    const [authOpen, setAuthOpen] = useState(false)
    const navigate = useNavigate()

    const features = [
        {
            icon: '✨',
            title: 'Adaptive Generation',
            description: 'AI-generated content dynamically tailored to your exact learning level and interests in real time.'
        },
        {
            icon: '🕹️',
            title: 'Interactive Sandboxes',
            description: 'Manipulate variables and observe outcomes through hands-on, high-fidelity physical simulations.'
        },
        {
            icon: '🧠',
            title: 'Socratic Diagnostics',
            description: 'Instead of answers, receive guided hints that build your critical thinking and problem-solving skills.'
        },
        {
            icon: '🌐',
            title: 'Cross-Domain Context',
            description: 'Apply core principles across Engineering and Educational contexts through distinct, specialized modules.'
        }
    ]

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/20 overflow-hidden relative flex flex-col">

            {/* Background design elements */}
            <div className="absolute top-0 inset-x-0 h-[800px] overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/50 blur-[120px]"></div>
                <div className="absolute top-[10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-100/50 blur-[100px]"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-sky-100/40 blur-[150px]"></div>
            </div>

            {/* Navigation - Glassmorphic */}
            <nav className="sticky top-0 z-50 transition-all duration-300 bg-white/70 backdrop-blur-xl border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
                            <span className="text-white text-lg font-bold">AL</span>
                        </div>
                        <div>
                            <span className="text-xl font-bold tracking-tight text-slate-900">ALGET</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {user ? (
                            <>
                                <span className="hidden sm:inline-block text-sm text-slate-500 font-medium mr-2">{user.email}</span>
                                <button
                                    onClick={() => navigate('/learn')}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium transition-colors shadow-sm shadow-indigo-600/20"
                                >
                                    Go to Modules
                                </button>
                                <button
                                    onClick={onLogout}
                                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthOpen(true)}
                                className="px-5 py-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm rounded-full font-semibold transition-all"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 pt-24 pb-20 text-center flex-1 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold mb-8 border border-indigo-100 uppercase tracking-widest shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    Next-Generation Learning Platform
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-slate-900">
                    <span className="block">The Generative</span>
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Intelligent Textbook
                    </span>
                </h1>

                <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                    Transforming education with adaptive narratives, interactive simulations, and personalized learning paths powered by advanced AI models.
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    {user ? (
                        <button
                            onClick={() => navigate('/learn')}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/25 hover:-translate-y-0.5 transition-all"
                        >
                            Access Your Modules
                        </button>
                    ) : (
                        <button
                            onClick={() => setAuthOpen(true)}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/25 hover:-translate-y-0.5 transition-all"
                        >
                            Get Started
                        </button>
                    )}
                    <button className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-semibold text-lg border border-slate-200 shadow-sm transition-colors">
                        Explore Features
                    </button>
                </div>
            </section>

            {/* Features Bento Grid */}
            <section className="relative z-10 bg-white border-t border-slate-200 py-24">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Designed for deep comprehension</h2>
                        <p className="text-slate-500 text-lg max-w-2xl mx-auto">Not just reading. Active, interactive, and personalized learning experiences.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {features.map((feature, i) => (
                            <div
                                key={i}
                                className="bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group"
                            >
                                <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-slate-900 tracking-tight">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed font-medium">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Application Flow */}
            <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-24">
                <div className="glass-panel bg-white/50 border border-slate-200 rounded-[3rem] p-10 md:p-16 shadow-2xl shadow-indigo-500/5 backdrop-blur-xl">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 tracking-tight">How the platform works</h2>
                            <div className="space-y-8 mt-10">
                                {[
                                    { step: '01', title: 'Select Track', desc: 'Choose between Engineering Mode or specific Education Modules.' },
                                    { step: '02', title: 'Unlock Access', desc: 'Enter the required passcode for your specific cohort.' },
                                    { step: '03', title: 'Learn Actively', desc: 'Engage with AI-generated scenarios, rigorous quizzes, and dynamic 3D simulation labs.' },
                                ].map((item) => (
                                    <div key={item.step} className="flex gap-5 items-start">
                                        <div className="text-sm font-bold text-indigo-400 bg-indigo-50 px-3 py-1 rounded-lg">
                                            {item.step}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1">{item.title}</h3>
                                            <p className="text-slate-600 font-medium">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Abstract visual representation of UI */}
                        <div className="relative h-full min-h-[300px] w-full bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl flex items-center justify-center">
                            <GenerativeIllustration />
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-slate-200 bg-white py-10 mt-auto">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm font-medium">
                    <p>© 2026 Generative Intelligent Textbook</p>
                    <p>Designed by Adaptive Design of e-Learning Lab</p>
                </div>
            </footer>

            {/* Auth Modal */}
            <AuthModal
                isOpen={authOpen}
                onClose={() => setAuthOpen(false)}
                onSuccess={(user) => {
                    setAuthOpen(false)
                    onLogin(user)
                }}
            />
        </div>
    )
}
