/**
 * Records the pen-annotated reading segment for each lecture clip and publishes the full clip:
 *
 *   node annotated/record.mjs [ClipName ...]      (from media_src/)
 *
 * For each clip in segments.json: lays out the passage in page.html, draws the marks (Rough
 * Notation), a pen-drawn illustration (rough.js) and margin notes (Hershey Text JS, single-stroke
 * script) to the narration beats,
 * captures every frame at 30 fps with Playwright, mixes the Kokoro narration, then joins the
 * ManimGL base clip (build/manim/<Clip>.mp4) and the segment into
 * ../frontend/public/media/ai-literacy/<Clip>.mp4, with captions continued in <Clip>.vtt.
 * Base-clip cue numbers are unchanged, so the in-clip quiz checkpoints still line up.
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MEDIA = join(HERE, '..')
const OUT = join(MEDIA, '..', 'frontend', 'public', 'media', 'ai-literacy')
const BUILD = join(MEDIA, 'build')
const FPS = 30
const GAP = 0.45 // pause after each narration beat, as in the ManimGL lectures
const require = createRequire(import.meta.url)
const hershey = require('hersheytext')
const { chromium } = await import(pathToFileURL(join(MEDIA, '..', 'frontend', 'node_modules', 'playwright', 'index.mjs')).href)

const SEGMENTS = JSON.parse(readFileSync(join(HERE, 'segments.json'), 'utf8')).segments
const DUR = JSON.parse(readFileSync(join(MEDIA, 'narration', 'durations.json'), 'utf8').replace(/^﻿/, ''))
const only = process.argv.slice(2)

const run = (cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr?.slice(-1500)}`)
    return r.stdout
}
const duration = (file) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim())
const ts = (t) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`
const parseVtt = (text) => [...text.matchAll(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\r?\n([\s\S]*?)(?:\r?\n\r?\n|$)/g)]
    .map(([, a, b, body]) => ({ a, b, body: body.trim() }))

function sceneFor(seg) {
    let t = 0.8
    const beats = seg.beats.map((b, i) => {
        const key = `${seg.voice}_b${i + 1}`
        if (!(key in DUR)) throw new Error(`no narration for ${key}; run make_narration.py`)
        const beat = { ...b, key, start: t, dur: DUR[key] }
        if (b.note) beat.note = { ...b.note, svg: hershey.renderTextSVG(b.note.text, { font: 'hershey_script_1', scale: 1 }) }
        // Illustration labels are Hershey script too.
        if (b.draw) beat.draw = b.draw.map((it) => (it.t ? { ...it, svg: hershey.renderTextSVG(it.t, { font: 'hershey_script_1', scale: 1 }) } : it))
        t += DUR[key] + GAP
        return beat
    })
    return { title: seg.title, passage: seg.passage, beats, end: t + 1.2 }
}

const browser = await chromium.launch()
try {
    for (const [clip, seg] of Object.entries(SEGMENTS)) {
        if (clip.startsWith('_') || (only.length && !only.includes(clip))) continue
        const started = Date.now()
        const scene = sceneFor(seg)
        const work = join(BUILD, 'reading', clip)
        rmSync(work, { recursive: true, force: true })
        mkdirSync(work, { recursive: true })

        // 1. Frames -> silent video.
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
        await page.goto(pathToFileURL(join(HERE, 'page.html')).href)
        await page.evaluate(() => document.fonts.ready)
        await page.evaluate((s) => window.setup(s), scene)
        const silent = join(work, 'video.mp4')
        const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] })
        const frames = Math.ceil(scene.end * FPS)
        for (let f = 0; f < frames; f++) {
            await page.evaluate((t) => window.seek(t), f / FPS)
            const jpg = await page.screenshot({ type: 'jpeg', quality: 92 })
            if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r))
        }
        ff.stdin.end()
        await new Promise((r, j) => ff.on('close', (code) => (code === 0 ? r() : j(new Error(`ffmpeg frames exit ${code}`)))))
        if (clip === (only[0] || clip)) await page.screenshot({ path: join(work, 'last-frame.png') })
        await page.close()

        // 2. Narration, each beat at its start time.
        const args = ['-y', '-loglevel', 'error', '-i', silent]
        scene.beats.forEach((b) => args.push('-i', join(MEDIA, 'narration', `${b.key}.mp3`)))
        const delays = scene.beats.map((b, i) => `[${i + 1}:a]adelay=${Math.round(b.start * 1000)}:all=1[a${i}]`).join(';')
        const mix = `${delays};${scene.beats.map((_, i) => `[a${i}]`).join('')}amix=inputs=${scene.beats.length}:normalize=0,apad[aout]`
        const segment = join(work, 'segment.mp4')
        run('ffmpeg', [...args, '-filter_complex', mix, '-map', '0:v', '-map', '[aout]', '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-ar', '44100', '-ac', '2', segment])

        // 3. Base ManimGL clip + reading segment.
        const base = join(BUILD, 'manim', `${clip}.mp4`)
        const baseDur = duration(base)
        run('ffmpeg', ['-y', '-loglevel', 'error', '-i', base, '-i', segment, '-filter_complex',
            '[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];[0:v][a0][1:v][a1]concat=n=2:v=1:a=1[v][a]',
            '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', join(OUT, `${clip}.mp4`)])

        // 4. Captions: base cues, then the reading cues shifted by the base length.
        const cues = parseVtt(readFileSync(join(BUILD, 'manim', `${clip}.vtt`), 'utf8'))
        scene.beats.forEach((b) => cues.push({ a: ts(baseDur + b.start), b: ts(baseDur + b.start + b.dur), body: b.say.replace(/A I/g, 'AI') }))
        writeFileSync(join(OUT, `${clip}.vtt`), ['WEBVTT', '', ...cues.flatMap((c, i) => [String(i + 1), `${c.a} --> ${c.b}`, c.body, ''])].join('\n'))
        console.log(`${clip}: base ${baseDur.toFixed(1)}s + reading ${scene.end.toFixed(1)}s (${frames} frames) in ${Math.round((Date.now() - started) / 1000)}s`)
    }
} finally {
    await browser.close()
}
