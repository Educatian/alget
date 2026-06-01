import { forwardRef } from 'react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BookLayout from './BookLayout'

vi.mock('../hooks/useCourseProgress', () => ({
    useCourseProgress: () => ({
        completedSections: [],
        markCompleted: vi.fn(),
        isCompleted: () => false,
        markRecentSection: vi.fn(),
        toggleBookmark: vi.fn(),
        isBookmarked: () => false,
        progressStats: {
            totalCompleted: 2,
            syncStatus: 'synced',
        },
    }),
}))

vi.mock('../hooks/useSocialPresence', () => ({
    useSocialPresence: () => ({
        connected: true,
        peers: [],
        sameHeadingPeers: 0,
        sameConceptPeers: 0,
        signalSummary: {},
        liveFeed: [],
        sendReaction: vi.fn(),
        recordHelpOpen: vi.fn().mockResolvedValue(undefined),
        recordCompletion: vi.fn().mockResolvedValue(undefined),
    }),
}))

vi.mock('../lib/loggingService', () => ({
    logEvent: vi.fn(),
    logPageView: vi.fn(),
    logStuckEvent: vi.fn(),
}))

vi.mock('../lib/knowledgeService', () => ({
    recordAdaptiveSignal: vi.fn(),
}))

vi.mock('../components/ReadingPane', () => ({
    default: (props) => <div data-testid="reading-pane">ReadingPane {props.sectionData?.meta?.title}</div>,
}))

vi.mock('../components/HighlightableContent', () => ({
    default: ({ children }) => <div data-testid="highlightable-content">{children}</div>,
}))

vi.mock('../components/IntelRail', () => ({
    default: () => <div data-testid="intel-rail">IntelRail</div>,
}))

vi.mock('../components/SocialPresencePanel', () => ({
    default: () => <div data-testid="social-presence">SocialPresencePanel</div>,
}))

vi.mock('../components/SettingsModal', () => ({
    default: () => <div data-testid="settings-modal">SettingsModal</div>,
}))

vi.mock('../components/ChatWidget', () => ({
    default: forwardRef(function MockChatWidget() {
        return <div data-testid="chat-widget">ChatWidget</div>
    }),
}))

describe('BookLayout integration', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn((url) => {
            const path = String(url)
            const courseMatch = path.match(/\/book\/([^/]+)/)
            const course = courseMatch?.[1] || 'inst-design'

            if (String(url).includes('/toc')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        title: course,
                        chapters: [
                            {
                                id: '01',
                                title: 'Module 1',
                                sections: [
                                    { id: '01', title: `${course} Section 01` },
                                ],
                            },
                        ],
                    }),
                })
            }

            return Promise.resolve({
                ok: true,
                json: async () => ({
                    meta: {
                        course,
                        chapter: '01',
                        section: '01',
                        title: `${course} Section 01`,
                        description: 'Foundational concepts for route smoke testing.',
                        concept_ids: ['artifact_trace'],
                    },
                    title: `${course} Section 01`,
                    raw: 'Section body',
                }),
            })
        })
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('renders the branded workspace header and loaded section surface', async () => {
        render(
            <MemoryRouter initialEntries={['/book/inst-design/01/01']}>
                <Routes>
                    <Route path="/book/:course/:chapter/:section" element={<BookLayout user={{ id: 'user-1', email: 'tester@ua.edu' }} onLogout={vi.fn()} />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('Alabama Generative Intelligent Textbook')).toBeInTheDocument()
        expect(screen.getByText('ALGET Reader')).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByTestId('reading-pane')).toHaveTextContent('inst-design Section 01')
        })
        expect(screen.getByText('Cloud sync on')).toBeInTheDocument()
    })

    it.each([
        ['ail606-supplement'],
        ['cat531-supplement'],
        ['cat100-supplement'],
    ])('smoke-renders the Summer 2026 supplement route for %s', async (course) => {
        render(
            <MemoryRouter initialEntries={[`/book/${course}/01/01`]}>
                <Routes>
                    <Route path="/book/:course/:chapter/:section" element={<BookLayout user={{ id: 'user-1', email: 'tester@ua.edu' }} onLogout={vi.fn()} />} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('reading-pane')).toHaveTextContent(`${course} Section 01`)
        })
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining(`/book/${course}/toc`))
        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining(`/book/${course}/01/01`))
    })
})
