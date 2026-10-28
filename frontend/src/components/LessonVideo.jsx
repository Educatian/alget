import { logEvent } from '../lib/loggingService'

/**
 * LessonVideo — a short course video served from this site (frontend/public/media/...).
 * Videos are rendered from media_src/ (ManimGL) and are silent with on-screen captions.
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
        <figure className="my-8 overflow-hidden rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] shadow-sm">
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
            />
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-2 text-xs text-[var(--ath-muted)]">
                <span className="font-semibold text-[var(--ath-text)]">{title}</span>
                <span>{caption || 'No sound: captions appear on screen.'}</span>
            </figcaption>
        </figure>
    )
}
