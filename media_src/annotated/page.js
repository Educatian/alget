/* global RoughNotation */
// Deterministic annotated-reading scene. record.mjs calls setup(scene) once, then seek(t) for
// every frame: annotations and handwriting are driven to exactly time t, so frames can be
// captured one by one at a fixed frame rate.

const COLORS = { ink: '#2a241f', red: '#c8402c', green: '#1f9d55', blue: '#2f6fd6', purple: '#a855f7', orange: '#e8710a', yellow: '#fbd968' }
const NS = 'http://www.w3.org/2000/svg'
const steps = [] // { start, dur, kind: 'mark'|'note', ... }
let parkAt = 0

function wrapPhrases(paragraphs, phrases) {
    const passage = document.getElementById('passage')
    const spans = {}
    paragraphs.forEach((text) => {
        const p = document.createElement('p')
        // Non-overlapping phrase ranges in this paragraph, in order.
        const ranges = []
        for (const ph of phrases) {
            const i = text.indexOf(ph)
            if (i > -1 && !spans[ph] && !ranges.some((r) => i < r.end && i + ph.length > r.start)) ranges.push({ start: i, end: i + ph.length, ph })
        }
        ranges.sort((a, b) => a.start - b.start)
        let at = 0
        for (const r of ranges) {
            p.append(text.slice(at, r.start))
            const span = document.createElement('span')
            span.textContent = r.ph
            p.append(span)
            spans[r.ph] = span
            at = r.end
        }
        p.append(text.slice(at))
        passage.append(p)
    })
    return spans
}

/** Prepares paths to be revealed stroke by stroke (one after another) with stroke-dashoffset. */
function strokesOf(paths, color, width = 3.2) {
    let total = 0
    const segs = paths.map((path) => {
        if (color) path.setAttribute('stroke', color)
        if (width) path.setAttribute('stroke-width', String(width))
        path.setAttribute('vector-effect', 'non-scaling-stroke')
        path.setAttribute('stroke-linecap', 'round')
        path.setAttribute('stroke-linejoin', 'round')
        const len = Math.max(0.01, path.getTotalLength())
        path.style.strokeDasharray = `${len} ${len}`
        path.style.strokeDashoffset = `${len}`
        const seg = { path, len, from: total }
        total += len
        return seg
    })
    return { segs, total }
}

const usedNoteY = []
function hersheyNote(svgMarkup, color, anchorSpan) {
    const g = document.createElementNS(NS, 'g')
    g.innerHTML = svgMarkup
    document.getElementById('notes').append(g)
    const box = anchorSpan.getBoundingClientRect()
    // Notes sit level with their phrase, above the illustration area, without overlapping.
    let y = Math.max(250, Math.min(560, box.top + box.height * 0.2))
    while (usedNoteY.some((u) => Math.abs(u - y) < 58)) y += 58
    usedNoteY.push(y)
    g.setAttribute('transform', `translate(1270 ${y}) scale(0.054)`)
    return strokesOf([...g.querySelectorAll('path')], COLORS[color] || COLORS.red)
}

// Pen-drawn illustration in the lower margin, built with rough.js (seeded, so every render matches).
const DOODLE = { x: 1268, y: 615, scale: 1.3 } // 460 x 330 design box -> about 600 x 430 px
let doodleSeed = 1
function doodlePart(items) {
    const root = document.getElementById('notes')
    const rc = rough.svg(root)
    const g = document.createElementNS(NS, 'g')
    g.setAttribute('transform', `translate(${DOODLE.x} ${DOODLE.y}) scale(${DOODLE.scale})`)
    root.append(g)
    const paths = []
    for (const it of items) {
        const color = COLORS[it.color] || '#2a241f'
        const opts = { stroke: color, strokeWidth: it.w || 2.6, roughness: 1.3, bowing: 1.2, seed: doodleSeed++ }
        if (it.fill) Object.assign(opts, { fill: COLORS[it.fill] || it.fill, fillStyle: 'hachure', hachureGap: 7, fillWeight: 1.6, hachureAngle: -41 })
        let node = null
        if (it.c) node = rc.circle(...it.c, opts)
        else if (it.e) node = rc.ellipse(...it.e, opts)
        else if (it.r) node = rc.rectangle(...it.r, opts)
        else if (it.l) node = rc.line(...it.l, opts)
        else if (it.poly) node = rc.polygon(it.poly, opts)
        else if (it.p) node = rc.path(it.p, opts)
        else if (it.svg) {
            node = document.createElementNS(NS, 'g')
            node.innerHTML = it.svg
            node.setAttribute('transform', `translate(${it.at[0]} ${it.at[1]}) scale(${it.size || 0.032})`)
            for (const p of node.querySelectorAll('path')) { p.setAttribute('stroke', color); p.setAttribute('stroke-width', '2.8') }
        }
        if (!node) continue
        g.append(node)
        // Outline strokes first, then hachure shading, so each shape is drawn and then shaded.
        const ps = [...node.querySelectorAll('path')]
        const shading = ps.filter((p) => p.getAttribute('stroke') !== color && p.getAttribute('fill') === 'none' && it.fill)
        paths.push(...ps.filter((p) => !shading.includes(p)), ...shading)
    }
    return strokesOf(paths, null, null)
}

function pointOn(path, length) {
    const p = path.getPointAtLength(Math.max(0, Math.min(length, path.getTotalLength())))
    const m = path.getScreenCTM()
    return new DOMPoint(p.x, p.y).matrixTransform(m)
}

function placePen(x, y) {
    document.getElementById('penbody').setAttribute('transform', `translate(${x} ${y})`)
}

window.setup = (scene) => {
    document.getElementById('title').textContent = scene.title
    const phrases = scene.beats.flatMap((b) => b.marks.map((m) => m.phrase))
    const spans = wrapPhrases(scene.passage, phrases)
    for (const beat of scene.beats) {
        // Within a beat: phrase marks, then the illustration part, then the margin note.
        const hasDraw = Boolean(beat.draw?.length)
        const win = hasDraw && beat.note ? { marks: 0.42, draw: [0.44, 0.74], note: [0.76, 0.97] }
            : hasDraw ? { marks: 0.48, draw: [0.5, 0.95] }
            : beat.note ? { marks: 0.6, note: [0.62, 0.95] }
            : { marks: 0.85 }
        const slot = (beat.dur * win.marks) / Math.max(1, beat.marks.length)
        beat.marks.forEach((m, k) => {
            const dur = Math.min(1.4, Math.max(0.6, slot * 0.8))
            const a = RoughNotation.annotate(spans[m.phrase], {
                type: m.type,
                color: m.type === 'highlight' ? COLORS.yellow : COLORS[m.color] || COLORS.red,
                strokeWidth: m.type === 'highlight' ? 1 : 3.2,
                padding: m.type === 'circle' ? 10 : m.type === 'box' ? 6 : 3,
                animationDuration: dur * 1000,
                iterations: m.type === 'highlight' ? 1 : 2,
                multiline: true,
            })
            steps.push({ kind: 'mark', start: beat.start + 0.25 + k * slot, dur, a, shown: false })
        })
        if (hasDraw) {
            const d = doodlePart(beat.draw)
            steps.push({ kind: 'strokes', start: beat.start + beat.dur * win.draw[0], dur: Math.max(0.8, beat.dur * (win.draw[1] - win.draw[0])), ...d })
        }
        if (beat.note) {
            const n = hersheyNote(beat.note.svg, beat.note.color, spans[beat.note.near])
            const start = beat.start + beat.dur * win.note[0]
            steps.push({ kind: 'strokes', start, dur: Math.min(1.8, Math.max(0.8, beat.dur * (win.note[1] - win.note[0]))), ...n })
        }
    }
    steps.sort((a, b) => a.start - b.start)
    parkAt = scene.end
    return { steps: steps.length }
}

window.seek = (t) => {
    let pen = null
    for (const s of steps) {
        if (t < s.start) continue
        const local = t - s.start
        if (s.kind === 'mark') {
            if (!s.shown) { s.a.show(); s.shown = true }
            // Rough Notation animates each stroke with a CSS animation (with per-stroke delays).
            const svg = s.a._svg || document.querySelector('svg.rough-annotation:last-of-type')
            const anims = (s.a._svg ? s.a._svg.getAnimations({ subtree: true }) : [])
            for (const an of anims) { an.pause(); an.currentTime = local * 1000 }
            if (local < s.dur * 2 && anims.length) {
                // Pen on the stroke currently being drawn.
                for (const an of anims) {
                    const el = an.effect?.target
                    const timing = an.effect?.getComputedTiming?.()
                    if (!el || !timing || timing.progress === null || timing.progress >= 1) continue
                    const len = el.getTotalLength()
                    pen = pointOn(el, len * timing.progress)
                    break
                }
            }
            void svg
        } else {
            const drawn = Math.min(1, local / s.dur) * s.total
            for (const seg of s.segs) {
                const own = Math.max(0, Math.min(seg.len, drawn - seg.from))
                seg.path.style.strokeDashoffset = `${seg.len - own}`
                if (own > 0 && own < seg.len) pen = pointOn(seg.path, own)
            }
            if (drawn < s.total && !pen) pen = pointOn(s.segs.at(-1).path, s.segs.at(-1).len)
        }
    }
    if (pen) placePen(pen.x, pen.y)
    else if (t >= parkAt - 0.6) placePen(2100, 1200)
    return Boolean(pen)
}
