import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import TextAnnotator from './TextAnnotator'
import { logInteraction, logEvent, logTimeOnTask } from '../lib/loggingService'

const DynamicScenario = lazy(() => import('./DynamicScenario'))
const ConceptDiagrams = lazy(() => import('./ConceptDiagrams'))
const InteractiveQuiz = lazy(() => import('./InteractiveQuiz'))
const InlineCheck = lazy(() => import('./InlineCheck'))
const RevealedWorkedExample = lazy(() => import('./RevealedWorkedExample'))
const Glossary = lazy(() => import('./Glossary'))
const RemotionClip = lazy(() => import('./RemotionClip'))
const ArtifactStudio = lazy(() => import('./ArtifactStudio'))

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
    onAskAi,
    onHeadingChange,
}) {
    const [activeHeading, setActiveHeading] = useState('')
    const startTimeRef = useRef(0)
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
        p: ({ children, ...props }) => {
            const text = extractNodeText(children)
            const hasBlockChild = Array.isArray(children)
                ? children.some((child) => child && typeof child === 'object' && child.type)
                : Boolean(children && typeof children === 'object' && children.type)

            if (hasBlockChild && !text.trim()) {
                return <>{children}</>
            }

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
            <pre tabIndex={0} {...props}>
                {children}
            </pre>
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
        'concept-diagram': (props) => renderLazyMarkdownModule(ConceptDiagrams, props),
        'interactive-quiz': ({ options, ...props }) => (
            <Suspense fallback={<MarkdownBlockFallback />}>
                <InteractiveQuiz
                    options={options}
                    sectionId={sectionId}
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
        'worked-example': (props) => renderLazyMarkdownModule(RevealedWorkedExample, { ...props, sectionId }),
        glossary: (props) => renderLazyMarkdownModule(Glossary, props),
        'remotion-clip': (props) => renderLazyMarkdownModule(RemotionClip, props),
        'torque-diagram': (props) => renderLazyMarkdownModule(TorqueDiagram, props),
        'kinematics-diagram': (props) => renderLazyMarkdownModule(KinematicsDiagram, props),
        'micro-turbulence-diagram': (props) => renderLazyMarkdownModule(MicroTurbulenceDiagram, props),
        'fluid-dynamics-diagram': (props) => renderLazyMarkdownModule(FluidDynamicsDiagram, props),
        'cellular-solid-diagram': (props) => renderLazyMarkdownModule(CellularSolidDiagram, props),
        'hierarchical-structure-diagram': (props) => renderLazyMarkdownModule(HierarchicalStructureDiagram, props),
        'directional-adhesion-diagram': (props) => renderLazyMarkdownModule(DirectionalAdhesionDiagram, props),
        'gecko-adhesion-diagram': (props) => renderLazyMarkdownModule(GeckoAdhesionDiagram, props),
        'structural-color-diagram': (props) => renderLazyMarkdownModule(StructuralColorDiagram, props),
        'self-healing-diagram': (props) => renderLazyMarkdownModule(SelfHealingDiagram, props),
        'swarm-diagram': (props) => renderLazyMarkdownModule(SwarmDiagram, props),
        'constructivism-diagram': (props) => renderLazyMarkdownModule(ConstructivismDiagram, props),
        'cognitivism-diagram': (props) => renderLazyMarkdownModule(CognitivismDiagram, props),
        'behaviorism-diagram': (props) => renderLazyMarkdownModule(BehaviorismDiagram, props),
        'formative-summative-diagram': (props) => renderLazyMarkdownModule(FormativeSummativeDiagram, props),
        'rubric-design-diagram': (props) => renderLazyMarkdownModule(RubricDesignDiagram, props),
        'feedback-models-diagram': (props) => renderLazyMarkdownModule(FeedbackModelsDiagram, props),
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

        const timeoutId = setTimeout(() => {
            const headings = document.querySelectorAll('.prose h1, .prose h2, .prose h3')
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

    return (
        <article
            className="prose reading-narrative mb-8"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '1200px' }}
        >
            <TextAnnotator
                onAskAi={(selectedText, latencyMs) => {
                    logInteraction('annotation_ask_ai', selectedText, sectionId)
                    if (latencyMs) {
                        logEvent('highlight_to_chat_latency', activeHeading, {
                            latency_ms: latencyMs,
                            viewport_context: activeHeading,
                            text: selectedText,
                        }, sectionId)
                    }
                    onAskAi?.(selectedText)
                }}
                onAddNote={(selectedText) => {
                    logInteraction('annotation_add_note', selectedText, sectionId)
                }}
                content={(
                    <Markdown
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                        components={markdownComponents}
                    >
                        {narrativeSource}
                    </Markdown>
                )}
            />
        </article>
    )
}
