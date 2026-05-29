import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import { logTimeOnTask } from '../lib/loggingService'
import { useTheme } from '../lib/themeContext'
import { READING_WIDTH_OPTIONS } from '../lib/readingPrefs'
// Typed SEMANTIC content nodes (PreTeXt semantic blocks + Torus purpose
// vocabulary) and knowl-style inline concept expansion. These are small and can
// render inline (ConceptRef sits inside a paragraph), so they are imported
// eagerly rather than lazily to avoid a block-level Suspense fallback flashing
// inside running prose.
import Definition from './Definition'
import Callout from './Callout'
import Figure from './Figure'
import ConceptRef from './ConceptRef'

// Map the UDL reading-width preference to a comfortable prose measure (the text
// line length). index.css consumes --reading-width on .reading-narrative; the
// preference layer (readingPrefs.js) historically set a different variable name,
// so the choice did nothing. We bridge it here by setting --reading-width
// directly from the live preference. Wider defaults than the legacy 76ch let a
// textbook use more of the viewport at >=1280px while keeping a sane measure.
const READING_WIDTH_MEASURE = {
    narrow: '74ch',
    standard: '92ch',
    wide: '118ch',
}
const DEFAULT_READING_MEASURE = READING_WIDTH_MEASURE.standard

function resolveReadingMeasure(readingWidth) {
    if (READING_WIDTH_MEASURE[readingWidth]) {
        return READING_WIDTH_MEASURE[readingWidth]
    }
    // Fall back to the option table so a future option still resolves to a value.
    const option = READING_WIDTH_OPTIONS.find((o) => o.value === readingWidth)
    return option?.width || DEFAULT_READING_MEASURE
}

const DynamicScenario = lazy(() => import('./DynamicScenario'))
const ConceptDiagrams = lazy(() => import('./ConceptDiagrams'))
const InteractiveQuiz = lazy(() => import('./InteractiveQuiz'))
const InlineCheck = lazy(() => import('./InlineCheck'))
const RevealedWorkedExample = lazy(() => import('./RevealedWorkedExample'))
const Glossary = lazy(() => import('./Glossary'))
const RemotionClip = lazy(() => import('./RemotionClip'))
const ArtifactStudio = lazy(() => import('./ArtifactStudio'))
const YouTubeEmbed = lazy(() => import('./YouTubeEmbed'))

// Advanced interactive learning components. Block-level interactives that the
// learner manipulates (sliders, ordering, branching, predict/explain), so they
// use the breakout wrapper for full content-column width and are lazy-loaded
// behind a Suspense fallback like the other interactives above.
const ParameterExplorer = lazy(() => import('./ParameterExplorer'))
const StepReveal = lazy(() => import('./StepReveal'))
const SequenceBuilder = lazy(() => import('./SequenceBuilder'))
const BranchingScenario = lazy(() => import('./BranchingScenario'))
const ConceptMapMini = lazy(() => import('./ConceptMapMini'))
const SelfExplain = lazy(() => import('./SelfExplain'))

const TorqueDiagram = lazy(() => import('./TorqueDiagram').then((module) => ({ default: module.TorqueDiagram })))
const MicroTurbulenceDiagram = lazy(() => import('./AeroacousticsDiagram').then((module) => ({ default: module.MicroTurbulenceDiagram })))
const KinematicsDiagram = lazy(() => import('./KinematicsDiagram').then((module) => ({ default: module.KinematicsDiagram })))
const FluidDynamicsDiagram = lazy(() => import('./FluidDynamicsDiagram').then((module) => ({ default: module.FluidDynamicsDiagram })))
const CellularSolidDiagram = lazy(() => import('./CellularSolidDiagram').then((module) => ({ default: module.CellularSolidDiagram })))
const HierarchicalStructureDiagram = lazy(() => import('./HierarchicalStructureDiagram').then((module) => ({ default: module.HierarchicalStructureDiagram })))
const DirectionalAdhesionDiagram = lazy(() => import('./DirectionalAdhesionDiagram').then((module) => ({ default: module.DirectionalAdhesionDiagram })))
const GeckoAdhesionDiagram = lazy(() => import('./GeckoAdhesionDiagram').then((module) => ({ default: module.GeckoAdhesionDiagram })))
const StructuralColorDiagram = lazy(() => import('./StructuralColorDiagram').then((module) => ({ default: module.StructuralColorDiagram })))
const SelfHealingDiagram = lazy(() => import('./SelfHealingDiagram').then((module) => ({ default: module.SelfHealingDiagram })))
const SwarmDiagram = lazy(() => import('./SwarmDiagram').then((module) => ({ default: module.SwarmDiagram })))
const ConstructivismDiagram = lazy(() => import('./ConstructivismDiagram').then((module) => ({ default: module.ConstructivismDiagram })))
const CognitivismDiagram = lazy(() => import('./CognitivismDiagram').then((module) => ({ default: module.CognitivismDiagram })))
const BehaviorismDiagram = lazy(() => import('./BehaviorismDiagram').then((module) => ({ default: module.BehaviorismDiagram })))
const FormativeSummativeDiagram = lazy(() => import('./FormativeSummativeDiagram').then((module) => ({ default: module.FormativeSummativeDiagram })))
const RubricDesignDiagram = lazy(() => import('./RubricDesignDiagram').then((module) => ({ default: module.RubricDesignDiagram })))
const FeedbackModelsDiagram = lazy(() => import('./FeedbackModelsDiagram').then((module) => ({ default: module.FeedbackModelsDiagram })))

// Strip markdown / MDX syntax down to readable prose for the Web Speech API.
function markdownToSpeechText(source) {
    return String(source || '')
        .replace(/<[^>]+>/g, ' ')              // strip raw / MDX tags
        .replace(/```[\s\S]*?```/g, ' ')        // fenced code blocks
        .replace(/`([^`]+)`/g, '$1')            // inline code
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')  // images
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> link text
        .replace(/^#{1,6}\s+/gm, '')            // heading markers
        .replace(/[*_~>#|]/g, ' ')              // residual markdown punctuation
        .replace(/\s+/g, ' ')
        .trim()
}

function MarkdownBlockFallback() {
    return <div className="my-6 h-44 animate-pulse rounded-[1.75rem] border border-slate-200 bg-slate-100/80" />
}

function renderLazyMarkdownModule(LazyComponent, props = {}) {
    return (
        <Suspense fallback={<MarkdownBlockFallback />}>
            <LazyComponent {...props} />
        </Suspense>
    )
}

// Diagrams and worked examples are figure-like blocks: let them use the full
// content-column width (breakout) instead of being cramped into the prose measure.
function renderBreakoutLazyModule(LazyComponent, props = {}) {
    return (
        <div className="reading-breakout not-prose">
            <Suspense fallback={<MarkdownBlockFallback />}>
                <LazyComponent {...props} />
            </Suspense>
        </div>
    )
}

function extractNodeText(node) {
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node)
    }

    if (Array.isArray(node)) {
        return node.map(extractNodeText).join(' ')
    }

    if (node && typeof node === 'object' && 'props' in node) {
        return extractNodeText(node.props?.children)
    }

    return ''
}

function createAnchorId(prefix, value) {
    const slug = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80)

    return `${prefix}-${slug || 'section'}`
}

function normalizeMarkdownSource(source) {
    const lines = String(source || '').replace(/\r\n/g, '\n').split('\n')
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
    const getIndent = (line) => line.match(/^\s*/)?.[0]?.length || 0
    const commonIndent = nonEmptyLines.reduce((current, line) => {
        const indent = getIndent(line)
        return Math.min(current, indent)
    }, Number.POSITIVE_INFINITY)

    if (Number.isFinite(commonIndent) && commonIndent > 0) {
        return lines.map((line) => line.slice(Math.min(commonIndent, getIndent(line)))).join('\n').trim()
    }

    const indentedLines = nonEmptyLines
        .map(getIndent)
        .filter((indent) => indent > 0)

    if (indentedLines.length >= Math.max(2, nonEmptyLines.length * 0.5)) {
        const dominantIndent = Math.min(...indentedLines)
        return lines.map((line) => line.slice(Math.min(dominantIndent, getIndent(line)))).join('\n').trim()
    }

    return lines.join('\n').trim()
}

export default function ReadingNarrative({
    content,
    sectionId,
    course,
    conceptIds,
    sectionDescription,
    onHeadingChange,
}) {
    const { readingPrefs } = useTheme()
    const readingMeasure = resolveReadingMeasure(readingPrefs?.readingWidth)
    const [activeHeading, setActiveHeading] = useState('')
    const [speechState, setSpeechState] = useState('idle') // 'idle' | 'speaking' | 'paused'
    const startTimeRef = useRef(0)
    const articleRef = useRef(null)
    const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
    const normalizedSource = normalizeMarkdownSource(content || sectionDescription || '*No content available*')
    const narrativeSource = normalizedSource.replace(/^#\s+.+(?:\n+|$)/, '')
    const usesMath = /\$[^$\n]+\$|\\\(|\\\[/.test(narrativeSource)
    const usesRawHtml = /<([a-z][a-z0-9-]*)(\s|>)/i.test(narrativeSource)

    const markdownComponents = useMemo(() => ({
        h1: ({ children, ...props }) => {
            const text = extractNodeText(children)
            return (
                <h1
                    id={createAnchorId('heading', text)}
                    data-reading-anchor={text.toLowerCase()}
                    data-reading-kind="heading"
                    {...props}
                >
                    {children}
                </h1>
            )
        },
        h2: ({ children, ...props }) => {
            const text = extractNodeText(children)
            return (
                <h2
                    id={createAnchorId('heading', text)}
                    data-reading-anchor={text.toLowerCase()}
                    data-reading-kind="heading"
                    {...props}
                >
                    {children}
                </h2>
            )
        },
        h3: ({ children, ...props }) => {
            const text = extractNodeText(children)
            return (
                <h3
                    id={createAnchorId('heading', text)}
                    data-reading-anchor={text.toLowerCase()}
                    data-reading-kind="heading"
                    {...props}
                >
                    {children}
                </h3>
            )
        },
        p: ({ node, children, ...props }) => {
            // react-markdown wraps content in <p>. When a paragraph actually
            // contains a BLOCK-level element (a raw <div> callout, a table/figure/
            // list, a nested <p>, or one of our custom hyphen-tag interactives), a
            // <div>/<p> nested inside <p> is invalid HTML and throws a hydration
            // error. Detect that via the source hast node and render the children
            // WITHOUT the <p> wrapper (fragment) so nesting stays valid.
            const BLOCK_TAGS = new Set([
                'div', 'section', 'figure', 'figcaption', 'table', 'pre', 'ul', 'ol',
                'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'p', 'aside', 'details',
            ])
            const hasBlockChild = Array.isArray(node?.children)
                && node.children.some(
                    (child) => child?.type === 'element'
                        && (BLOCK_TAGS.has(child.tagName) || String(child.tagName || '').includes('-')),
                )

            if (hasBlockChild) {
                return <>{children}</>
            }

            const text = extractNodeText(children)
            return (
                <p
                    data-reading-anchor={text.toLowerCase()}
                    data-reading-kind="paragraph"
                    {...props}
                >
                    {children}
                </p>
            )
        },
        pre: ({ children, ...props }) => (
            <pre className="reading-breakout" {...props}>
                {children}
            </pre>
        ),
        table: ({ children, ...props }) => (
            // Wide tabular content breaks out of the narrow prose measure up to
            // the content-column width, and scrolls horizontally on small screens
            // so it never overflows the viewport.
            <div className="reading-breakout reading-table-scroll not-prose">
                <table {...props}>{children}</table>
            </div>
        ),
        'dynamic-scenario': (props) => (
            <Suspense fallback={<MarkdownBlockFallback />}>
                <DynamicScenario
                    {...props}
                    course={course || 'bio-inspired'}
                />
            </Suspense>
        ),
        'artifact-studio': (props) => (
            <Suspense fallback={<MarkdownBlockFallback />}>
                <ArtifactStudio
                    {...props}
                    sectionId={sectionId}
                    conceptIds={conceptIds || []}
                    sectionTitle={sectionDescription || ''}
                />
            </Suspense>
        ),
        'concept-diagram': (props) => renderBreakoutLazyModule(ConceptDiagrams, props),
        'interactive-quiz': ({ options, conceptid, ...props }) => (
            <Suspense fallback={<MarkdownBlockFallback />}>
                <InteractiveQuiz
                    options={options}
                    sectionId={sectionId}
                    conceptId={conceptid || conceptIds?.[0] || null}
                    defaultConceptId={conceptIds?.[0] || null}
                    {...props}
                />
            </Suspense>
        ),
        'inline-check': ({ options, question, conceptid, ...props }) => (
            <Suspense fallback={<MarkdownBlockFallback />}>
                <InlineCheck
                    options={options}
                    question={question}
                    sectionId={sectionId}
                    conceptId={conceptid || conceptIds?.[0] || null}
                    {...props}
                />
            </Suspense>
        ),
        'worked-example': (props) => renderBreakoutLazyModule(RevealedWorkedExample, { ...props, sectionId }),
        glossary: (props) => renderLazyMarkdownModule(Glossary, props),
        'remotion-clip': (props) => renderLazyMarkdownModule(RemotionClip, props),
        'youtube-embed': (props) => renderLazyMarkdownModule(YouTubeEmbed, props),
        'torque-diagram': (props) => renderBreakoutLazyModule(TorqueDiagram, props),
        'kinematics-diagram': (props) => renderBreakoutLazyModule(KinematicsDiagram, props),
        'micro-turbulence-diagram': (props) => renderBreakoutLazyModule(MicroTurbulenceDiagram, props),
        'fluid-dynamics-diagram': (props) => renderBreakoutLazyModule(FluidDynamicsDiagram, props),
        'cellular-solid-diagram': (props) => renderBreakoutLazyModule(CellularSolidDiagram, props),
        'hierarchical-structure-diagram': (props) => renderBreakoutLazyModule(HierarchicalStructureDiagram, props),
        'directional-adhesion-diagram': (props) => renderBreakoutLazyModule(DirectionalAdhesionDiagram, props),
        'gecko-adhesion-diagram': (props) => renderBreakoutLazyModule(GeckoAdhesionDiagram, props),
        'structural-color-diagram': (props) => renderBreakoutLazyModule(StructuralColorDiagram, props),
        'self-healing-diagram': (props) => renderBreakoutLazyModule(SelfHealingDiagram, props),
        'swarm-diagram': (props) => renderBreakoutLazyModule(SwarmDiagram, props),
        'constructivism-diagram': (props) => renderBreakoutLazyModule(ConstructivismDiagram, props),
        'cognitivism-diagram': (props) => renderBreakoutLazyModule(CognitivismDiagram, props),
        'behaviorism-diagram': (props) => renderBreakoutLazyModule(BehaviorismDiagram, props),
        'formative-summative-diagram': (props) => renderBreakoutLazyModule(FormativeSummativeDiagram, props),
        'rubric-design-diagram': (props) => renderBreakoutLazyModule(RubricDesignDiagram, props),
        'feedback-models-diagram': (props) => renderBreakoutLazyModule(FeedbackModelsDiagram, props),
        // Advanced interactive learning components. react-markdown lowercases
        // tag and attribute names and passes every MDX attribute value as a
        // STRING, so each component parses its own config/steps/items/tree/
        // concepts JSON defensively (mirroring how interactive-quiz/inline-check
        // parse their options). They are block-level interactives, so they use
        // the breakout wrapper for full content-column width with a Suspense
        // fallback. Section/concept context is threaded through for the ones that
        // log interactions or resolve the concept registry.
        'parameter-explorer': (props) => renderBreakoutLazyModule(ParameterExplorer, props),
        'step-reveal': (props) => renderBreakoutLazyModule(StepReveal, props),
        'sequence-builder': (props) => renderBreakoutLazyModule(SequenceBuilder, props),
        'branching-scenario': (props) => renderBreakoutLazyModule(BranchingScenario, props),
        'concept-map': (props) => renderBreakoutLazyModule(ConceptMapMini, { course: course || undefined, ...props }),
        'self-explain': ({ conceptid, ...props }) => renderBreakoutLazyModule(SelfExplain, {
            ...props,
            sectionId,
            conceptId: conceptid || conceptIds?.[0] || null,
        }),
        // Typed SEMANTIC content nodes (PreTeXt semantic blocks + Torus purpose
        // vocabulary). Additive: existing presentational markdown is unchanged;
        // authors opt in by using these tags. react-markdown lowercases tag and
        // attribute names, so authored <Definition conceptId> arrives here as
        // <definition conceptid>; the components accept the lowercase form.
        definition: (props) => <Definition {...props} />,
        callout: (props) => <Callout {...props} />,
        'figure-block': (props) => <Figure {...props} />,
        // Knowl-style inline cross-reference expansion (PreTeXt knowl.js):
        // expands the referenced concept in place via an accessible popover.
        'concept-ref': (props) => <ConceptRef {...props} />,
    }), [conceptIds, course, sectionDescription, sectionId])

    const remarkPlugins = useMemo(
        () => (usesMath ? [remarkGfm, remarkMath] : [remarkGfm]),
        [usesMath]
    )

    const rehypePlugins = useMemo(() => {
        const plugins = []
        if (usesMath) {
            plugins.push(rehypeKatex)
        }
        if (usesRawHtml) {
            plugins.push(rehypeRaw)
        }
        return plugins
    }, [usesMath, usesRawHtml])

    useEffect(() => {
        startTimeRef.current = Date.now()

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntries = entries.filter((entry) => entry.isIntersecting)
                if (visibleEntries.length === 0) return
                visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
                setActiveHeading(visibleEntries[0].target.innerText)
            },
            { rootMargin: '-10% 0px -80% 0px', threshold: 0.1 }
        )

        // Scope the heading query to THIS narrative's <article> (not a global
        // .prose selector) so a coexisting/lazy sibling .prose block can't make
        // setActiveHeading report the wrong section's heading.
        const timeoutId = setTimeout(() => {
            const root = articleRef.current || document
            const headings = root.querySelectorAll('h1, h2, h3')
            headings.forEach((heading) => observer.observe(heading))
        }, 500)

        return () => {
            clearTimeout(timeoutId)
            observer.disconnect()
            if (sectionId) {
                const durationMs = Date.now() - startTimeRef.current
                logTimeOnTask(durationMs, sectionId)
            }
        }
    }, [sectionId])

    useEffect(() => {
        onHeadingChange?.(activeHeading)
    }, [activeHeading, onHeadingChange])

    // Read-aloud (UDL Guideline 1: multiple means of representation).
    // Browser-native speechSynthesis; no backend. Stop narration when the section changes.
    useEffect(() => {
        if (!speechSupported) return
        window.speechSynthesis.cancel()
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset read-aloud UI to idle when the section changes (syncs with speechSynthesis external system)
        setSpeechState('idle')
        return () => {
            window.speechSynthesis.cancel()
        }
    }, [sectionId, speechSupported])

    const handlePlayPause = () => {
        if (!speechSupported) return
        const synth = window.speechSynthesis
        if (speechState === 'speaking') {
            synth.pause()
            setSpeechState('paused')
            return
        }
        if (speechState === 'paused') {
            synth.resume()
            setSpeechState('speaking')
            return
        }
        const text = markdownToSpeechText(narrativeSource)
        if (!text) return
        synth.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.onend = () => setSpeechState('idle')
        utterance.onerror = () => setSpeechState('idle')
        synth.speak(utterance)
        setSpeechState('speaking')
    }

    const handleStopSpeech = () => {
        if (!speechSupported) return
        window.speechSynthesis.cancel()
        setSpeechState('idle')
    }

    return (
        <article
            ref={articleRef}
            className="prose reading-narrative reading-narrative-fluid mb-8"
            style={{
                contentVisibility: 'auto',
                containIntrinsicSize: '1200px',
                // Bridge the UDL reading-width preference to the variable index.css
                // actually consumes, and let the article itself fill the content
                // column so figure-like blocks can use the full width.
                '--reading-width': readingMeasure,
                // Drive the article's own max-width from the shared breakout
                // token so the two can't drift: if --reading-breakout is ever
                // widened, the article box widens with it (prevents re-clipping).
                '--reading-column-max': 'var(--reading-breakout, 74rem)',
            }}
        >
            {/*
                The article fills the content column (--reading-column-max). Text
                elements (paragraphs, list items, headings, blockquotes) stay at a
                comfortable measure (--reading-width) and are centered, while
                figure-like blocks (tables, code, formulas, diagrams, worked
                examples) use the full column width. This overrides index.css's
                narrow max-width on .reading-narrative without editing that file.
            */}
            <style>{`
                .reading-narrative-fluid {
                    max-width: min(var(--reading-column-max, 74rem), 100%);
                }
                .reading-narrative-fluid > :where(p, ul, ol, blockquote, h1, h2, h3, h4, .reading-readaloud) {
                    max-width: min(var(--reading-width, 78ch), 100%);
                    margin-right: auto;
                    margin-left: auto;
                }
                .reading-narrative-fluid .reading-breakout {
                    width: 100%;
                    max-width: 100%;
                }
                .reading-narrative-fluid .reading-table-scroll {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .reading-narrative-fluid .reading-table-scroll > table {
                    margin-top: 0;
                    margin-bottom: 0;
                }
            `}</style>
            {speechSupported && (
                <div
                    className="reading-readaloud not-prose mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] px-4 py-2.5 shadow-sm"
                    role="group"
                    aria-label="Read this section aloud"
                >
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                        Listen
                    </span>
                    <button
                        type="button"
                        onClick={handlePlayPause}
                        aria-label={
                            speechState === 'speaking'
                                ? 'Pause reading this section aloud'
                                : speechState === 'paused'
                                    ? 'Resume reading this section aloud'
                                    : 'Read this section aloud'
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ath-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ath-text)] transition-colors hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                    >
                        <span aria-hidden="true">{speechState === 'speaking' ? '⏸' : '▶'}</span>
                        <span>
                            {speechState === 'speaking' ? 'Pause' : speechState === 'paused' ? 'Resume' : 'Play'}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={handleStopSpeech}
                        disabled={speechState === 'idle'}
                        aria-label="Stop reading this section aloud"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ath-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ath-text)] transition-colors hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span aria-hidden="true">⏹</span>
                        <span>Stop</span>
                    </button>
                    <span className="sr-only" role="status" aria-live="polite">
                        {speechState === 'speaking'
                            ? 'Reading section aloud'
                            : speechState === 'paused'
                                ? 'Reading paused'
                                : 'Reading stopped'}
                    </span>
                </div>
            )}
            <Markdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
            >
                {narrativeSource}
            </Markdown>
        </article>
    )
}
