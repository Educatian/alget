import { forwardRef } from 'react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BookLayout from './BookLayout'

vi.mock('../hooks/useCourseProgress', () => ({
    useCourseProgress: () => ({
        completedSections: [],
        markCompleted: vi.fn(),
        isCompleted: () => false,
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
            if (String(url).includes('/toc')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        title: 'Instructional Design',
                        chapters: [
                            {
                                id: '01',
                                title: 'Introduction to Instructional Design',
                                sections: [
                                    { id: '01', title: 'Module 1: What is Instructional Design?' },
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
                        course: 'inst-design',
                        chapter: '01',
                        section: '01',
                        title: 'Module 1: What is Instructional Design?',
                        description: 'Foundational concepts for instructional design.',
                        concept_ids: ['instructional_design'],
                    },
                    title: 'Module 1: What is Instructional Design?',
                    raw: 'Section body',
                }),
            })
        })
    })

    afterEach(() => {
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
        expect(screen.getByText('Learning Workspace')).toBeInTheDocument()
        expect(await screen.findByTestId('reading-pane')).toHaveTextContent('Module 1: What is Instructional Design?')
        expect(screen.getByText('Cloud sync on')).toBeInTheDocument()
    })
})
