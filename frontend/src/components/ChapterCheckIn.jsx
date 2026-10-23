import { useState } from 'react'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { logEvent } from '../lib/loggingService'

export const MIN_CHECKIN_WORDS = 20

function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Required chapter check-in (study participants): at the end of each chapter the
 * learner explains the main idea to BigAL in their own words and BigAL replies
 * with feedback and a follow-up question in the chat.
 */
export default function ChapterCheckIn({ course, chapter, chapterTitle, sectionId, done, onDone }) {
    const [text, setText] = useState('')
    const words = wordCount(text)
    const chapterLabel = `Chapter ${Number(chapter) || chapter}${chapterTitle ? `: ${chapterTitle}` : ''}`

    const send = () => {
        if (words < MIN_CHECKIN_WORDS) return
        const explanation = text.trim()
        logEvent('chapter_checkin', `${course}/${chapter}`, {
            course, chapter, chapter_title: chapterTitle || null,
            explanation: explanation.slice(0, 4000), word_count: words,
        }, sectionId)
        window.dispatchEvent(new CustomEvent('open-chat', {
            detail: {
                autoSend: true,
                message: `Chapter check-in for ${chapterLabel}. Here is my explanation of the most important idea in this chapter and where I would use it: "${explanation}" Please tell me what I got right, gently correct anything I got wrong, and ask me one follow-up question.`,
            },
        }))
        onDone?.()
    }

    return (
        <section className="mt-12 rounded-[2rem] border border-[var(--ath-primary)] bg-[var(--ath-panel)] p-8 shadow-sm">
            <p className="editorial-kicker flex items-center gap-2">
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Chapter check-in with BigAL
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-[var(--ath-text)]">{chapterLabel}</h3>
            {done ? (
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--ath-primary)]">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    Check-in done. You can keep the conversation going with BigAL in the chat.
                </p>
            ) : (
                <>
                    <p className="mt-3 text-sm leading-7 text-[var(--ath-text)]">
                        Required to finish this chapter. In your own words, explain the most important idea in this chapter
                        and give one example of where you would use it. BigAL will reply with feedback and a follow-up question.
                    </p>
                    <label htmlFor={`checkin-${course}-${chapter}`} className="sr-only">Your explanation</label>
                    <textarea
                        id={`checkin-${course}-${chapter}`}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={5}
                        className="editorial-input mt-4 w-full"
                        placeholder="The most important idea in this chapter is..."
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className={`text-xs ${words >= MIN_CHECKIN_WORDS ? 'text-[var(--ath-primary)]' : 'text-[var(--ath-muted)]'}`}>
                            {words} / {MIN_CHECKIN_WORDS} words minimum
                        </span>
                        <button
                            type="button"
                            onClick={send}
                            disabled={words < MIN_CHECKIN_WORDS}
                            className="editorial-button px-5 py-2.5 text-sm disabled:opacity-60"
                        >
                            Send to BigAL
                        </button>
                    </div>
                </>
            )}
        </section>
    )
}
