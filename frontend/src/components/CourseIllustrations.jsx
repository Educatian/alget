import React from 'react';

// Abstract glowing structure/truss for Statics
export const StaticsIllustration = ({ className = "w-16 h-16" }) => (
    <div className={`relative flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="statics-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#cbd5e1" />
                    <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <filter id="statics-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            {/* Spinning background construction arcs */}
            <g opacity="0.3">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2 4" className="animate-[spin_20s_linear_infinite]" />
            </g>
            {/* Trusses */}
            <path d="M20 75 L50 25 L80 75 Z" fill="none" stroke="url(#statics-grad)" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M20 75 L80 75 L50 50 Z" fill="none" stroke="url(#statics-grad)" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M50 25 L50 75" fill="none" stroke="url(#statics-grad)" strokeWidth="2.5" opacity="0.6" />

            {/* Nodes */}
            <circle cx="50" cy="25" r="5" fill="#f8fafc" filter="url(#statics-glow)" className="animate-pulse" />
            <circle cx="20" cy="75" r="5" fill="#94a3b8" filter="url(#statics-glow)" />
            <circle cx="80" cy="75" r="5" fill="#94a3b8" filter="url(#statics-glow)" />
            <circle cx="50" cy="50" r="4" fill="#38bdf8" filter="url(#statics-glow)" className="animate-ping" style={{ animationDuration: '2s' }} />
        </svg>
    </div>
);

// Abstract organic structure for Bio-Inspired
export const BioInspiredIllustration = ({ className = "w-16 h-16" }) => (
    <div className={`relative flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bio-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <filter id="bio-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            {/* Background organic ring */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#34d399" opacity="0.2" strokeWidth="0.5" strokeDasharray="3 3" className="animate-[spin_30s_linear_infinite_reverse]" />

            {/* DNA / Leaf abstract curves */}
            <path d="M30 80 Q 50 50, 70 20" fill="none" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" opacity="0.7" className="animate-[dash_3s_linear_infinite]" strokeDasharray="10 10" />
            <path d="M70 80 Q 50 50, 30 20" fill="none" stroke="url(#bio-grad)" strokeWidth="3" strokeLinecap="round" />

            {/* Horizontal bonds */}
            <g stroke="#a7f3d0" strokeWidth="1.5" opacity="0.6">
                <line x1="41" y1="35" x2="59" y2="35" />
                <line x1="39" y1="65" x2="61" y2="65" />
                <line x1="50" y1="50" x2="50" y2="50" />
            </g>

            {/* Glowing nodes at intersections */}
            <circle cx="70" cy="20" r="4" fill="#a7f3d0" filter="url(#bio-glow)" className="animate-pulse" />
            <circle cx="30" cy="80" r="4" fill="#10b981" filter="url(#bio-glow)" />
            <circle cx="50" cy="50" r="5" fill="#ffffff" filter="url(#bio-glow)" className="animate-pulse" style={{ animationDuration: '1.5s' }} />
            <circle cx="30" cy="20" r="3" fill="#047857" filter="url(#bio-glow)" />
            <circle cx="70" cy="80" r="3" fill="#34d399" filter="url(#bio-glow)" />
        </svg>
    </div>
);

// Abstract nodes/brain/book for Instructional Design
export const InstDesignIllustration = ({ className = "w-16 h-16" }) => (
    <div className={`relative flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="edu-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <filter id="edu-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            {/* Background cognitive rings */}
            <circle cx="50" cy="50" r="38" fill="none" stroke="#93c5fd" opacity="0.3" strokeWidth="1" className="animate-[spin_40s_linear_infinite]" strokeDasharray="4 8" />

            {/* Central connected network representing learning pathways */}
            <path d="M25 50 Q 50 20, 75 50 T 50 80 Q 25 50, 50 50 Z" fill="none" stroke="url(#edu-grad)" strokeWidth="2.5" opacity="0.9" />

            {/* Spark nodes */}
            <circle cx="50" cy="20" r="4" fill="#bfdbfe" filter="url(#edu-glow)" className="animate-pulse" />
            <circle cx="75" cy="50" r="5" fill="#3b82f6" filter="url(#edu-glow)" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
            <circle cx="50" cy="80" r="4" fill="#60a5fa" filter="url(#edu-glow)" className="animate-pulse" style={{ animationDelay: '1s' }} />
            <circle cx="25" cy="50" r="5" fill="#bfdbfe" filter="url(#edu-glow)" className="animate-pulse" style={{ animationDelay: '1.5s' }} />

            {/* The "spark" in the center */}
            <circle cx="50" cy="50" r="3" fill="#ffffff" filter="url(#edu-glow)" />
            <path d="M 47 50 L 53 50 M 50 47 L 50 53" stroke="#bfdbfe" strokeWidth="1.5" />

            {/* Floating abstract document pages */}
            <g className="animate-[float_4s_ease-in-out_infinite]" transform-origin="30 25">
                <rect x="25" y="20" width="12" height="15" rx="1" fill="#ffffff" filter="url(#edu-glow)" opacity="0.8" transform="rotate(-15 30 25)" />
            </g>
            <g className="animate-[float_5s_ease-in-out_infinite_reverse]" transform-origin="70 75">
                <rect x="65" y="65" width="10" height="12" rx="1" fill="#eff6ff" filter="url(#edu-glow)" opacity="0.8" transform="rotate(20 70 75)" />
            </g>
        </svg>
    </div>
);
