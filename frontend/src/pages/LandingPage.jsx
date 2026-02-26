import { useState } from 'react'
import GearAnimation from '../components/GearAnimation'
import AuthModal from '../components/AuthModal'

export default function LandingPage({ onLogin }) {
    const [authOpen, setAuthOpen] = useState(false)

    const features = [
        {
            icon: '📚',
            title: 'Adaptive Learning',
            description: 'AI-generated content tailored to your level and interests'
        },
        {
            icon: '🎮',
            title: 'Interactive Simulations',
            description: 'Hands-on visualizations powered by Plotly.js'
        },
        {
            icon: '🧮',
            title: 'Smart Quizzes',
            description: 'Hint system with progress tracking and feedback'
        },
        {
            icon: '🏈',
            title: 'UA Context',
            description: 'Real-world examples from University of Alabama'
        }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1e1b2e] to-[#120f1c] text-white overflow-hidden relative">
            {/* Gear Animation Background */}
            <GearAnimation />
            <div className="absolute top-0 inset-x-0 h-[800px] overflow-hidden pointer-events-none z-0">
                <div className="glow-orb-dark bg-indigo-500/30 w-[40rem] h-[40rem] -top-40 -left-20 animate-float-slow"></div>
                <div className="glow-orb-dark bg-[#9E1B32]/30 w-[35rem] h-[35rem] top-20 -right-20 animate-float-delayed"></div>
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex justify-between items-center px-8 py-6">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">⚙️</span>
                    <span className="text-2xl font-bold tracking-tight">ALGET</span>
                </div>
                <button
                    onClick={() => setAuthOpen(true)}
                    className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-full font-medium transition-all border border-white/20 backdrop-blur-sm"
                >
                    Sign In
                </button>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 max-w-6xl mx-auto px-8 py-20 text-center">
                <div className="inline-block px-4 py-1.5 bg-[#9E1B32]/20 rounded-full text-sm font-medium mb-6 border border-[#9E1B32]/40">
                    🏈 University of Alabama • Mechanical Engineering
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight drop-shadow-2xl">
                    <span className="bg-gradient-to-r from-white via-indigo-50 to-slate-300 bg-clip-text text-transparent">
                        AI-Powered Learning
                    </span>
                    <br />
                    <span className="animate-gradient-x bg-gradient-to-r from-[#ff4d6d] via-[#9E1B32] to-[#ff4d6d] bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(255,77,109,0.5)]">for Engineers</span>
                </h1>

                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
                    ALGET transforms engineering education with adaptive narratives,
                    interactive simulations, and personalized learning paths powered by Google Gemini.
                </p>

                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => setAuthOpen(true)}
                        className="px-8 py-4 bg-gradient-to-r from-[#9E1B32] to-[#C41E3A] rounded-xl font-bold text-lg shadow-[0_0_30px_rgba(158,27,50,0.5)] hover:shadow-[0_0_50px_rgba(196,30,58,0.7)] hover:-translate-y-1 transition-all border border-white/20"
                    >
                        Get Started Free
                    </button>
                    <button className="px-8 py-4 bg-white/10 hover:bg-white/15 rounded-xl font-semibold text-lg border border-white/20 transition-all">
                        Learn More
                    </button>
                </div>
            </section>

            {/* Features Grid */}
            <section className="relative z-10 max-w-6xl mx-auto px-8 py-20">
                <h2 className="text-3xl font-bold text-center mb-12">Why ALGET?</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className="glass-panel border-white/10 bg-white/5 p-6 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-300 group cursor-pointer"
                        >
                            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300 drop-shadow-md">{feature.icon}</div>
                            <h3 className="text-lg font-bold mb-2 text-indigo-50 leading-tight">{feature.title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section className="relative z-10 max-w-4xl mx-auto px-8 py-20">
                <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
                <div className="space-y-8">
                    {[
                        { step: 1, title: 'Select Your Module', desc: 'Choose from Dynamics, Statics, Thermodynamics, and more' },
                        { step: 2, title: 'Pick Topics', desc: 'Select specific concepts you want to learn' },
                        { step: 3, title: 'Generate Content', desc: 'AI creates narratives, quizzes, and simulations just for you' },
                    ].map((item) => (
                        <div key={item.step} className="flex gap-6 items-center">
                            <div className="w-14 h-14 bg-gradient-to-br from-[#9E1B32] to-[#7A1527] rounded-full flex items-center justify-center text-xl font-bold shrink-0">
                                {item.step}
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">{item.title}</h3>
                                <p className="text-gray-400">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>



            {/* Footer */}
            <footer className="relative z-10 border-t border-white/10 py-8 text-center text-gray-500 text-sm">
                <p>© 2026 ALGET • AI-Powered Learning for Engineers • 🏈 Roll Tide!</p>
                <p className="mt-1 text-gray-600">Designed by Adaptive Design of e-Learning Lab</p>
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
