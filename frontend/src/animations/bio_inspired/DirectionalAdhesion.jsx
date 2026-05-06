/**
 * DirectionalAdhesion - Remotion pilot composition.
 *
 * 45 seconds @ 30fps = 1350 frames.
 *
 * Pedagogy (REMOTION_ANIMATION_MAP §bio-inspired/01/03):
 *   "Animation of gecko setae array engaging/detaching at angle change.
 *    Setae array attaches; preload + shear shown by arrow; smooth detach
 *    as angle changes; contrast with isotropic adhesive that fails at the
 *    same load."
 *
 * Renders inside `@remotion/player`'s <Player> in-app, and is also
 * registered for the Remotion CLI (npm run remotion:preview /
 * remotion:render) via frontend/remotion/Root.jsx.
 */
import { useCurrentFrame } from 'remotion'

const FPS_LOCAL = 30

function lerp(from, to, t) {
    return from + (to - from) * Math.max(0, Math.min(1, t))
}

function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export default function DirectionalAdhesion() {
    const frame = useCurrentFrame()
    const sec = frame / FPS_LOCAL

    // Phase 1 (0-8s): introduce the gecko foot
    // Phase 2 (8-22s): shear engagement - setae bend, contact area grows
    // Phase 3 (22-32s): peel angle change - adhesion releases smoothly
    // Phase 4 (32-45s): contrast vs. isotropic adhesive (fails at same load)
    const phase = sec < 8 ? 1 : sec < 22 ? 2 : sec < 32 ? 3 : 4

    const shearProgress = ease(Math.max(0, Math.min(1, (sec - 8) / 14)))
    const peelProgress = ease(Math.max(0, Math.min(1, (sec - 22) / 10)))
    const contrastProgress = ease(Math.max(0, Math.min(1, (sec - 32) / 13)))

    const setaeBend = lerp(0, 35, shearProgress)
    const peelAngle = lerp(0, 60, peelProgress)
    const contactArea = phase === 2
        ? lerp(0.1, 0.95, shearProgress)
        : phase === 3
            ? lerp(0.95, 0.05, peelProgress)
            : phase === 4
                ? lerp(0.5, 0, contrastProgress)
                : 0.1

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(180deg, #f6f4ef 0%, #c8e2ec 100%)',
                fontFamily: 'Inter, system-ui, sans-serif',
                position: 'relative',
                color: '#093848',
            }}
        >
            <header style={{ position: 'absolute', top: 32, left: 48, right: 48 }}>
                <p style={{
                    fontSize: 14,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#214b59',
                }}>
                    Bio-Inspired Design / 01.03
                </p>
                <h1 style={{ fontSize: 36, margin: '6px 0 0', fontWeight: 600 }}>
                    Directional Adhesion: How Geckos Stick
                </h1>
            </header>

            <svg
                viewBox="0 0 1280 720"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
                {/* Surface (ceiling) */}
                <line x1="200" y1="380" x2="1080" y2="380" stroke="#093848" strokeWidth="3" />

                {/* Gecko foot */}
                <g transform={`translate(640, 380) rotate(${peelAngle})`}>
                    <rect x="-100" y="0" width="200" height="60" rx="14" fill="#214b59" />
                    <text x="0" y="38" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="600">
                        Gecko foot
                    </text>

                    {/* Setae array */}
                    {Array.from({ length: 14 }).map((_, i) => {
                        const x = -90 + i * 14
                        const inContact = i / 14 < contactArea
                        return (
                            <g key={i}>
                                <line
                                    x1={x}
                                    y1={0}
                                    x2={x - setaeBend * 0.4}
                                    y2={-26}
                                    stroke={inContact ? '#c78943' : '#94a3b8'}
                                    strokeWidth="2"
                                />
                                {inContact && (
                                    <circle cx={x - setaeBend * 0.4} cy={-26} r="2.5" fill="#c78943" />
                                )}
                            </g>
                        )
                    })}
                </g>

                {/* Shear arrow during phase 2 */}
                {phase === 2 && (
                    <g>
                        <line
                            x1="640"
                            y1="500"
                            x2={640 + 200 * shearProgress}
                            y2="500"
                            stroke="#9E1B32"
                            strokeWidth="4"
                            markerEnd="url(#arrow)"
                        />
                        <text x="740" y="540" fill="#9E1B32" fontSize="16" fontWeight="600">
                            Shear preload
                        </text>
                    </g>
                )}

                {/* Peel-angle indicator during phase 3 */}
                {phase === 3 && (
                    <text x="640" y="600" textAnchor="middle" fill="#093848" fontSize="20" fontWeight="600">
                        Peel angle: {peelAngle.toFixed(0)} deg - setae release
                    </text>
                )}

                {/* Contrast adhesive failure during phase 4 */}
                {phase === 4 && (
                    <g transform="translate(900, 400)">
                        <rect
                            x="-80"
                            y="0"
                            width="160"
                            height="50"
                            rx="6"
                            fill="#94a3b8"
                            opacity={1 - contrastProgress}
                        />
                        <text
                            x="0"
                            y="-10"
                            textAnchor="middle"
                            fill="#9E1B32"
                            fontSize="16"
                            fontWeight="600"
                            opacity={contrastProgress}
                        >
                            Isotropic adhesive: fails at same load
                        </text>
                    </g>
                )}

                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" fill="#9E1B32" />
                    </marker>
                </defs>
            </svg>

            <footer style={{
                position: 'absolute',
                bottom: 28,
                left: 48,
                right: 48,
                fontSize: 14,
                color: '#214b59',
            }}>
                Take-away: direction is part of the design - not a side effect.
            </footer>
        </div>
    )
}
