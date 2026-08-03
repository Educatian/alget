/**
 * Lay narration and subtitles over a recorded demo.
 *
 * The recorder writes tmp/agentic-demo/captions.json with each caption's start
 * time, so narration clips land where the caption they belong to appears rather
 * than drifting against one continuous track.
 *
 * Expects one clip per caption at tmp/agentic-demo/vo/NN.mp3 (01, 02, ...),
 * generated from the same captions.json. Missing clips are skipped, so a
 * partial voice-over still produces a valid video.
 *
 *   node scripts/narrate-demo.mjs            # subtitles + narration
 *   node scripts/narrate-demo.mjs --srt-only # subtitles only
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const DIR = path.resolve('tmp/agentic-demo')
const VIDEO = path.join(DIR, 'alget-demo.mp4')
const VO_DIR = path.join(DIR, 'vo')
const SRT = path.join(DIR, 'alget-demo.srt')
const OUT = path.join(DIR, 'alget-demo-narrated.mp4')
const srtOnly = process.argv.includes('--srt-only')

const pad = (n) => String(n).padStart(2, '0')

function timecode(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms % 1000).padStart(3, '0')}`
}

/** Break a caption into at most two lines so it reads at a glance. */
function wrap(text, width = 58) {
  const words = text.split(/\s+/)
  const lines = ['']
  for (const word of words) {
    const line = lines[lines.length - 1]
    if (!line) lines[lines.length - 1] = word
    else if ((line + ' ' + word).length <= width) lines[lines.length - 1] = `${line} ${word}`
    else lines.push(word)
  }
  return lines.slice(0, 3).join('\n')
}

const captions = JSON.parse(await fs.readFile(path.join(DIR, 'captions.json'), 'utf8'))
const duration = Number((await run('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', VIDEO,
])).stdout.trim())

const srt = captions.map((entry, index) => {
  const start = entry.at
  const end = Math.min(entry.end ?? start + 4, duration)
  return `${index + 1}\n${timecode(start)} --> ${timecode(Math.max(end, start + 1.2))}\n${wrap(entry.text)}\n`
}).join('\n')
await fs.writeFile(SRT, srt, 'utf8')
console.log(`subtitles: ${SRT} (${captions.length} cues, video ${duration.toFixed(1)}s)`)

if (srtOnly) process.exit(0)

// Narration is written separately from the on-screen captions: the captions
// label what is happening, the voice explains why it matters. Fall back to the
// captions when no narration script is present.
let script = captions
try {
  script = JSON.parse(await fs.readFile(path.join(DIR, 'narration.json'), 'utf8'))
  console.log(`narration script: ${script.length} lines`)
} catch { /* captions double as the script */ }

const clips = []
for (const [index, entry] of script.entries()) {
  const file = path.join(VO_DIR, `${pad(index + 1)}.mp3`)
  try {
    await fs.access(file)
    clips.push({ file, at: entry.at })
  } catch {
    console.log(`  no clip for line ${index + 1}: ${entry.text.slice(0, 48)}...`)
  }
}
if (!clips.length) {
  console.log('No narration clips found; wrote subtitles only.')
  process.exit(0)
}

// Delay each clip to its cue, then mix. `amix` normalises by input count, so
// scale back up to keep a single speaking voice at full level.
const inputs = clips.flatMap((clip) => ['-i', clip.file])
const delays = clips.map((clip, i) =>
  `[${i + 1}:a]adelay=${Math.round(clip.at * 1000)}|${Math.round(clip.at * 1000)}[a${i}]`).join(';')
const mixIn = clips.map((_, i) => `[a${i}]`).join('')
const filter = `${delays};${mixIn}amix=inputs=${clips.length}:duration=longest:dropout_transition=0,volume=${clips.length}[vo]`

await run('ffmpeg', [
  '-v', 'error', '-i', VIDEO, ...inputs,
  '-filter_complex', filter,
  '-map', '0:v', '-map', '[vo]',
  // No -shortest: the narration ends before the video does, and truncating to
  // the audio would cut the closing frames.
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
  OUT, '-y',
])
console.log(`narrated: ${OUT} (${clips.length}/${captions.length} cues voiced)`)
