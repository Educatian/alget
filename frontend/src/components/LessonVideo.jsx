import { logEvent } from '../lib/loggingService'

/**
 * LessonVideo — a short course video served from this site (frontend/public/media/...).
 * Videos are narrated lectures rendered from media_src/ (ManimGL + Kokoro TTS); each has a
 * WebVTT caption file with the same name next to it.
 *
 * MDX usage:
 *   <lesson-video src="/media/ai-literacy/NextWordVideo.mp4" title="…" caption="…" />
 */
export default function LessonVideo({ src, title, caption, sectionId }) {
    if (typeof src !== 'string' || !/^\/media\/[a-z0-9/_-]+\.mp4$/i.test(src)) {
        return (
            <div className="my-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="status">
                Video unavailable: <code>{String(src)}</code>
            </div>
        )
    }
    const log = (type, e) => logEvent(type, null, { video: src, at_s: Math.round(e.currentTarget.currentTime) }, sectionId)
    return (
        <figure className="reading-breakout reading-breakout--media not-prose my-10 overflow-hidden rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] shadow-sm">
            <video
                src={src}
                controls
                preload="metadata"
                playsInline
                className="block aspect-video w-full bg-[#f5f0e6]"
                aria-label={title}
                onPlay={(e) => log('lesson_video_play', e)}
                onPause={(e) => log('lesson_video_pause', e)}
                onEnded={(e) => log('lesson_video_finished', e)}
            >
                <track kind="captions" src={src.replace(/\.mp4$/i, '.vtt')} srcLang="en" label="English" default />
            </video>
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-2 text-xs text-[var(--ath-muted)]">
                <span className="font-semibold text-[var(--ath-text)]">{title}</span>
                {caption && <span>{caption}</span>}
            </figcaption>
        </figure>
    )
}
