/** Read aloud with the browser's own speech engine (Web Speech API); nothing leaves the device. */

export const canReadAloud = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function stopReading() {
    if (canReadAloud()) window.speechSynthesis.cancel()
}

/** Speaks `text`; calls onBoundary(charIndex) as words are read and onEnd() when done. */
export function readAloud(text, { onBoundary, onEnd, rate = 1 } = {}) {
    if (!canReadAloud() || !text) return false
    stopReading()
    const utterance = new SpeechSynthesisUtterance(String(text))
    utterance.lang = 'en-US'
    utterance.rate = rate
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('en') && /natural|neural|online/i.test(v.name))
    if (voice) utterance.voice = voice
    if (onBoundary) utterance.onboundary = (e) => onBoundary(e.charIndex)
    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    window.speechSynthesis.speak(utterance)
    return true
}
