import React from 'react'

export default function GenerativeIllustration() {
    return (
        <div className="relative w-full h-full flex items-center justify-center p-4">
            <svg
                viewBox="0 0 400 400"
                className="w-full h-full max-w-md drop-shadow-2xl overflow-visible"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="center-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6d28d9" /> {/* purple-700 */}
                        <stop offset="100%" stopColor="#4338ca" /> {/* purple-800 */}
                    </linearGradient>

                    <linearGradient id="orbit-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0ea5e9" /> {/* cyan-500 */}
                        <stop offset="100%" stopColor="#3b82f6" /> {/* blue-500 */}
                    </linearGradient>

                    <filter id="glow-strong" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="12" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>

                    <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Subdued Background Grid Arcs */}
                <g opacity="0.15">
                    <circle cx="200" cy="200" r="180" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" className="animate-[spin_60s_linear_infinite]" />
                    <circle cx="50" cy="250" r="120" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" className="animate-[spin_40s_linear_infinite_reverse]" transform-origin="50 250" />
                    <circle cx="350" cy="50" r="100" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 4" className="animate-[spin_50s_linear_infinite]" transform-origin="350 50" />
                </g>

                {/* Dashed Figure-8 / Orbital Paths */}
                {/* Left Orbit */}
                <path d="M200 200 C 130 130, 80 200, 160 260" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeDasharray="8 6" opacity="0.8" className="animate-[dash_3s_linear_infinite]" />
                <path d="M160 260 C 200 300, 240 250, 200 200" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="8 6" opacity="0.8" className="animate-[dash_3s_linear_infinite_reverse]" />

                {/* Right Orbit */}
                <path d="M200 200 C 250 120, 320 180, 280 240" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeDasharray="6 6" opacity="0.8" className="animate-[dash_3s_linear_infinite]" />
                <path d="M280 240 C 250 280, 210 240, 200 200" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeDasharray="6 6" opacity="0.8" className="animate-[dash_3s_linear_infinite_reverse]" />

                {/* Solid Connections */}
                <g stroke="#6366f1" strokeWidth="2" opacity="0.7">
                    <line x1="200" y1="200" x2="140" y2="135" />
                    <line x1="200" y1="200" x2="160" y2="250" />
                    <line x1="200" y1="200" x2="250" y2="155" />
                    <line x1="200" y1="200" x2="270" y2="260" />
                </g>

                {/* Outer Nodes */}
                {/* Top Left */}
                <circle cx="140" cy="135" r="7" fill="#3b82f6" />
                {/* Bottom Left */}
                <circle cx="160" cy="250" r="9" fill="#0ea5e9" filter="url(#glow-light)" />
                {/* Top Right */}
                <circle cx="250" cy="155" r="8" fill="#a855f7" />
                {/* Bottom Right */}
                <circle cx="270" cy="260" r="12" fill="#7c3aed" filter="url(#glow-light)" />

                {/* Core Central Node */}
                <g transform="translate(200, 200)" className="animate-pulse" style={{ animationDuration: '3s' }}>
                    <circle cx="0" cy="0" r="32" fill="url(#center-glow)" opacity="0.4" filter="url(#glow-strong)" />
                    <circle cx="0" cy="0" r="22" fill="url(#center-glow)" filter="url(#glow-light)" opacity="0.9" />
                    <circle cx="0" cy="0" r="12" fill="#e0e7ff" opacity="1" />
                    {/* The Inner Cross */}
                    <path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" />
                </g>

                {/* Floating Abstract Documents */}
                {/* Top Left Document */}
                <g className="animate-[float_5s_ease-in-out_infinite]" transform-origin="150 100">
                    <g transform="translate(130, 80) rotate(-15)">
                        <rect x="-25" y="-30" width="50" height="60" rx="3" fill="#ffffff" filter="url(#glow-light)" opacity="0.9" />
                        <rect x="-25" y="-30" width="50" height="60" rx="3" fill="#f8fafc" />
                        <rect x="-15" y="-15" width="20" height="3" rx="1.5" fill="#94a3b8" opacity="0.6" />
                        <rect x="-15" y="-5" width="30" height="2" rx="1" fill="#cbd5e1" opacity="0.6" />
                        <rect x="-15" y="5" width="30" height="2" rx="1" fill="#cbd5e1" opacity="0.6" />
                    </g>
                </g>

                {/* Right Document */}
                <g className="animate-[float_6s_ease-in-out_infinite_reverse]" transform-origin="280 200">
                    <g transform="translate(270, 210) rotate(20)">
                        <rect x="-25" y="-35" width="50" height="70" rx="3" fill="#ffffff" filter="url(#glow-light)" opacity="0.9" />
                        <rect x="-25" y="-35" width="50" height="70" rx="3" fill="#f8fafc" />
                        <rect x="-15" y="-15" width="25" height="3" rx="1.5" fill="#94a3b8" opacity="0.6" />
                        <rect x="-15" y="-5" width="30" height="2" rx="1" fill="#cbd5e1" opacity="0.6" />
                        <rect x="-15" y="5" width="20" height="2" rx="1" fill="#cbd5e1" opacity="0.6" />
                    </g>
                </g>

                <style>
                    {`
                        @keyframes dash {
                            to {
                                stroke-dashoffset: -20;
                            }
                        }
                        @keyframes float {
                            0% { transform: translateY(0px) rotate(0deg); }
                            50% { transform: translateY(-8px) rotate(2deg); }
                            100% { transform: translateY(0px) rotate(0deg); }
                        }
                    `}
                </style>
            </svg>
        </div>
    )
}
