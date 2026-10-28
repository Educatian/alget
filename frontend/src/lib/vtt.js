/** Start and end times (seconds) of each cue in a WebVTT file. */
export function parseVttTimes(text) {
    const seconds = (t) => t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0)
    return [...String(text).matchAll(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/g)]
        .map(([, a, b]) => ({ start: seconds(a), end: seconds(b) }))
}
