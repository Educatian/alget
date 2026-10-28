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
        const video = await screen.findByLabelText('How a language model writes (70 s)')
        expect(video.getAttribute('src')).toBe('/media/ai-literacy/NextWordVideo.mp4')
    })

    it('embeds a lab and a video in each module, and no external YouTube videos', () => {
        const all = ['01', '02', '03', '04'].flatMap((ch) => ['01', '02', '03'].map((sec) => read(ch, sec))).join('\n')
        expect(all.match(/<sketch-lab /g)).toHaveLength(4)
        expect(all.match(/<lesson-video /g)).toHaveLength(4)
        expect(all).not.toContain('<youtube-embed')
    })
})
