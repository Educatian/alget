/**
 * Remotion clip registry. Each entry: name → lazy component + duration.
 *
 * Inline MDX usage:
 *   <remotion-clip name="bio_inspired/directional_adhesion" />
 * The RemotionClip wrapper reads this registry to resolve the component.
 *
 * Adding a clip:
 *   1. Author at frontend/src/animations/<course>/<concept>.jsx (default export
 *      is the Remotion composition).
 *   2. Register here: name → import + duration in frames at 30 fps.
 *   3. Reference from MDX with the registered name.
 */
import { lazy } from 'react'

export const FPS = 30

export const REMOTION_CLIPS = {
    'bio_inspired/directional_adhesion': {
        Component: lazy(() => import('./bio_inspired/DirectionalAdhesion')),
        durationFrames: 30 * 45, // 45 seconds
        title: 'Directional Adhesion: Gecko Setae in Action',
    },
}

export function getClip(name) {
    return REMOTION_CLIPS[name] || null
}
