import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingNarrative from './ReadingNarrative'

vi.mock('../lib/loggingService', () => ({ logEvent: vi.fn(), logInteraction: vi.fn(), logTimeOnTask: vi.fn() }))
vi.mock('../lib/simTelemetry', () => ({ logSimEvent: vi.fn() }))

const COURSE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'ai-literacy')
const read = (ch, sec) => readFileSync(join(COURSE, ch, `${sec}.mdx`), 'utf8')

describe('AI Literacy course content', () => {
    beforeEach(() => {
        globalThis.IntersectionObserver = vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() }))
    })

    it('has four modules of three sections, each with all four sidecar files', () => {
        const chapters = readdirSync(COURSE).filter((d) => /^\d\d$/.test(d))
        expect(chapters).toEqual(['01', '02', '03', '04'])
        for (const ch of chapters) {
            const files = readdirSync(join(COURSE, ch))
            for (const sec of ['01', '02', '03']) {
                for (const ext of ['mdx', 'meta.json', 'practice.json', 'misconceptions.json']) {
                    expect(files).toContain(`${sec}.${ext}`)
                }
            }
        }
    })

    it('renders the module 1 video and the next-word 3D lab from the real section', async () => {
        render(<ReadingNarrative content={read('01', '02')} sectionId="ai-literacy/01/02" course="ai-literacy" conceptIds={['next_token_prediction']} />)
        const lab = await screen.findByTitle('How AI writes: the probability wheel')
        const src = new URL(lab.getAttribute('src'))
        expect(src.origin).toBe('https://energy-sketchbook.pages.dev')
        expect(src.searchParams.get('book')).toBe('ai')
        expect(src.searchParams.get('lesson')).toBe('next-word')
        expect(src.searchParams.get('embed')).toBe('1')
        const video = await screen.findByLabelText('How a language model writes (1 min 38 s)')
        expect(video.getAttribute('src')).toBe('/media/ai-literacy/NextWordVideo.mp4')
        expect(video.querySelector('track[kind="captions"]').getAttribute('src')).toBe('/media/ai-literacy/NextWordVideo.vtt')
    })

    it('embeds a lab in each module, a lecture clip and a written activity in each section, and no YouTube videos', () => {
        const sections = ['01', '02', '03', '04'].flatMap((ch) => ['01', '02', '03'].map((sec) => [ch, sec]))
        const all = sections.map(([ch, sec]) => read(ch, sec)).join('\n')
        expect(all.match(/<sketch-lab /g)).toHaveLength(4)
        expect(all).not.toContain('<youtube-embed')
        const media = join(COURSE, '..', '..', 'public', 'media', 'ai-literacy')
        for (const [ch, sec] of sections) {
            const body = read(ch, sec)
            const clips = [...body.matchAll(/<lesson-video src="\/media\/ai-literacy\/(\w+)\.mp4"/g)].map((m) => m[1])
            expect(clips).toHaveLength(1)
            // Captions and in-clip check-ins sit next to every clip.
            for (const ext of ['mp4', 'vtt', 'quiz.json']) expect(readdirSync(media)).toContain(`${clips[0]}.${ext}`)
            expect(body.match(/<apply-activity \/>/g)).toHaveLength(1)
            const activity = JSON.parse(readFileSync(join(COURSE, ch, `${sec}.activity.json`), 'utf8'))
            expect(activity.criteria.length).toBeGreaterThanOrEqual(3)
            expect(activity.reference.length).toBeGreaterThan(80)
        }
    })
})
