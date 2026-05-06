import { Suspense, useRef } from 'react'
import { Player } from '@remotion/player'
import { getClip, FPS } from '../animations/registry'
import { logEvent } from '../lib/loggingService'

/**
 * RemotionClip — inline player for a Remotion composition.
 *
 * Mounts @remotion/player's <Player> with the registered composition. The
 * composition (e.g. animations/bio_inspired/DirectionalAdhesion.jsx) reads
 * the current frame via useCurrentFrame() from 'remotion'.
 *
 * MDX usage:
 *   <remotion-clip name="bio_inspired/directional_adhesion" />
 */
export default function RemotionClip({ name, width = 1280, height = 720 }) {
    const clip = getClip(name)
    const playerRef = useRef(null)

    if (!clip) {
        return (
            <div className="my-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                Remotion clip "{name}" is not registered. Add it to <code>animations/registry.js</code>.
            </div>
        )
    }

    const Component = clip.Component

    return (
        <div className="my-6 overflow-hidden rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] shadow-sm">
            <Suspense fallback={<div className="aspect-video w-full animate-pulse bg-slate-100" />}>
                <Player
                    ref={playerRef}
                    component={Component}
                    durationInFrames={clip.durationFrames}
                    fps={FPS}
                    compositionWidth={width}
                    compositionHeight={height}
                    style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
                    controls
                    showVolumeControls={false}
                    clickToPlay
                    doubleClickToFullscreen
                    spaceKeyToPlayOrPause
                    acknowledgeRemotionLicense
                    initiallyShowControls
                    renderLoading={() => <div className="h-full w-full animate-pulse bg-slate-100" />}
                    onPlay={() => logEvent('remotion_clip_play', null, { clip: name })}
                    onPause={() => logEvent('remotion_clip_pause', null, { clip: name })}
                    onEnded={() => logEvent('remotion_clip_finished', null, { clip: name })}
                />
            </Suspense>
            <div className="flex items-center justify-between border-t border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-2 text-xs text-[var(--ath-muted)]">
                <span>{clip.title}</span>
                <span>{(clip.durationFrames / FPS).toFixed(0)}s / {FPS}fps</span>
            </div>
        </div>
    )
}
