function normalizeVideoId(value = '') {
    const raw = String(value || '').trim()
    const match = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)
    const candidate = match?.[1] || raw
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null
}

export default function YouTubeEmbed({ id, title = 'Embedded video', caption = '' }) {
    const videoId = normalizeVideoId(id)

    if (!videoId) {
        return null
    }

    return (
        <figure className="my-8 overflow-hidden rounded-2xl border border-[var(--ath-line)] bg-white shadow-sm">
            <div className="aspect-video bg-[var(--ath-panel-muted)]">
                <iframe
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                    title={title}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            </div>
            {caption ? (
                <figcaption className="border-t border-[var(--ath-line)] px-4 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                    {caption}
                </figcaption>
            ) : null}
        </figure>
    )
}
