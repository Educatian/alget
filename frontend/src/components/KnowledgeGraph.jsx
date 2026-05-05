import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/apiConfig'

function humanizeLabel(value) {
    if (!value) return 'Untitled concept'
    return value
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase())
}

function buildLayout(nodes) {
    const chapterSpacing = 260
    const sectionSpacing = 150
    const conceptSpacing = 92
    const leftPadding = 140
    const topPadding = 110

    const positionedNodes = nodes.map((node) => ({
        ...node,
        x: leftPadding + ((node.chapter_order || 1) - 1) * chapterSpacing + ((node.section_order || 1) - 1) * 24,
        y: topPadding + ((node.section_order || 1) - 1) * sectionSpacing + ((node.concept_order || 1) - 1) * conceptSpacing,
    }))

    const width = Math.max(
        900,
        leftPadding + (Math.max(...positionedNodes.map((node) => node.x), 0)) + 220,
    )
    const height = Math.max(
        520,
        topPadding + (Math.max(...positionedNodes.map((node) => node.y), 0)) + 140,
    )

    return {
        nodes: positionedNodes,
        width,
        height,
    }
}

function describeNodeStatus(node) {
    if (node.is_current) return 'current focus'
    if (node.status === 'mastered') return 'stable'
    if (node.status === 'emerging') return 'developing'
    return 'not enough evidence'
}

export default function KnowledgeGraph({
    course = 'inst-design',
    currentSectionId = null,
    currentConceptIds = [],
}) {
    const [graphData, setGraphData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [hoveredNode, setHoveredNode] = useState(null)
    const serializedCurrentConcepts = JSON.stringify(currentConceptIds)
    const navigate = useNavigate()

    const handleNodeClick = (node) => {
        // node.section_id is the slug "course/chapter/section" emitted by
        // build_mastery_graph_payload. Treat the brain network as a
        // navigation surface: clicking a concept jumps to its section.
        if (!node?.section_id) return
        navigate(`/book/${node.section_id}`)
    }

    useEffect(() => {
        let isCancelled = false

        const fetchGraph = async () => {
            setLoading(true)
            setError(null)

            try {
                const currentConcepts = JSON.parse(serializedCurrentConcepts)
                const { data: { session } } = await supabase.auth.getSession()
                const userId = session?.user?.id

                const masteryMap = {}
                if (userId) {
                    const { data: masteryRecords, error: masteryError } = await supabase
                        .from('mastery')
                        .select('concept_id, p_known, mastery_score')
                        .eq('user_id', userId)

                    if (masteryError) {
                        throw masteryError
                    }

                    if (masteryRecords) {
                        masteryRecords.forEach((record) => {
                            masteryMap[record.concept_id] = record.mastery_score ?? record.p_known ?? 0.1
                        })
                    }
                }

                const response = await fetch(`${API_BASE}/mastery_graph`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mastery_data: masteryMap,
                        course,
                        current_section_id: currentSectionId,
                        current_concepts: currentConcepts,
                    }),
                })

                if (!response.ok) {
                    const errText = await response.text()
                    throw new Error(`Failed to load graph data: ${response.status} ${errText}`)
                }

                const data = await response.json()
                const layout = buildLayout(data.nodes || [])

                if (!isCancelled) {
                    setGraphData({
                        ...layout,
                        links: data.links || [],
                    })
                }
            } catch (err) {
                console.error(err)
                if (!isCancelled) {
                    setError(err.message || 'Failed to load graph data.')
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false)
                }
            }
        }

        fetchGraph()

        return () => {
            isCancelled = true
        }
    }, [course, currentSectionId, serializedCurrentConcepts])

    if (loading) {
        return <div className="text-center p-8 text-slate-500 animate-pulse">Loading brain network...</div>
    }

    if (error) {
        return <div className="text-center p-8 text-red-500">Failed to load brain network.</div>
    }

    if (!graphData || graphData.nodes.length === 0) {
        return <div className="text-center p-8 text-slate-500">No connected concepts found for this course yet.</div>
    }

    const getNodeColor = (node) => {
        if (node.is_current) return 'fill-indigo-500 stroke-indigo-200'
        if (node.status === 'mastered') return 'fill-emerald-500 stroke-emerald-200'
        if (node.status === 'emerging') return 'fill-amber-400 stroke-amber-100'
        return 'fill-slate-400 stroke-slate-200'
    }

    const getGlow = (node) => {
        if (node.is_current) return 'drop-shadow-[0_0_14px_rgba(99,102,241,0.55)]'
        if (node.status === 'mastered') return 'drop-shadow-[0_0_10px_rgba(16,185,129,0.45)]'
        if (node.status === 'emerging') return 'drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
        return ''
    }

    const chapterHeaders = Array.from(
        new Map(
            graphData.nodes.map((node) => [
                `${node.chapter_order}`,
                {
                    id: node.chapter_order,
                    title: node.chapter_title || humanizeLabel(node.chapter),
                    x: node.x,
                },
            ]),
        ).values(),
    )

    return (
        <div className="knowledge-graph-mount bg-slate-950 rounded-3xl p-6 shadow-2xl overflow-hidden relative border border-slate-800">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-white font-bold text-lg">Brain Network</h3>
                    <p className="text-slate-400 text-sm max-w-2xl">
                        This is an action map for the current work product. Use amber and slate nodes to decide what evidence to annotate next, then return to the Work Product Studio and revise the artifact trace.
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />Current focus</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Developing</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Stable</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Evidence needed</span>
                </div>
            </div>

            <div className="mb-5 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300 md:grid-cols-[1fr_1fr]">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">What this shows</p>
                    <p className="mt-2 leading-6">
                        Node color is not a grade. It is a signal about how much usable evidence the system has for the concept in this section, including reading, annotation, practice, and artifact traces.
                    </p>
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Next action</p>
                    <p className="mt-2 leading-6">
                        Click a developing or evidence-needed node, annotate one source-backed claim, then revise the current work product with a short rationale for accepting, modifying, or rejecting AI feedback.
                    </p>
                </div>
            </div>

            <div className="relative w-full overflow-x-auto rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
                <svg width="100%" height="540" viewBox={`0 0 ${graphData.width} ${graphData.height}`} className="min-w-[860px]">
                    <defs>
                        <pattern id="graph-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
                        </pattern>
                    </defs>

                    <rect width={graphData.width} height={graphData.height} fill="url(#graph-grid)" />

                    {chapterHeaders.map((chapter) => (
                        <g key={chapter.id}>
                            <text
                                x={chapter.x - 28}
                                y="58"
                                fill="#cbd5e1"
                                fontSize="14"
                                fontWeight="700"
                                letterSpacing="0.08em"
                            >
                                {chapter.title}
                            </text>
                            <line
                                x1={chapter.x - 30}
                                y1="74"
                                x2={chapter.x + 130}
                                y2="74"
                                stroke="rgba(148,163,184,0.16)"
                                strokeWidth="1"
                            />
                        </g>
                    ))}

                    {graphData.links.map((link, index) => {
                        const sourceNode = graphData.nodes.find((node) => node.id === link.source)
                        const targetNode = graphData.nodes.find((node) => node.id === link.target)
                        if (!sourceNode || !targetNode) return null

                        const isHighlighted =
                            hoveredNode === sourceNode.id ||
                            hoveredNode === targetNode.id ||
                            sourceNode.is_current ||
                            targetNode.is_current

                        return (
                            <line
                                key={`${link.source}-${link.target}-${index}`}
                                x1={sourceNode.x}
                                y1={sourceNode.y}
                                x2={targetNode.x}
                                y2={targetNode.y}
                                stroke={isHighlighted ? 'rgba(129,140,248,0.65)' : 'rgba(148,163,184,0.22)'}
                                strokeWidth={isHighlighted ? '3' : '1.75'}
                                className="transition-all duration-300"
                            />
                        )
                    })}

                    {graphData.nodes.map((node) => {
                        const isHovered = hoveredNode === node.id
                        const radius = node.is_current ? 24 : node.status === 'mastered' ? 20 : node.status === 'emerging' ? 18 : 16
                        const label = node.label || humanizeLabel(node.id)
                        const labelWidth = Math.max(92, label.length * 8 + 18)

                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x},${node.y})`}
                                onMouseEnter={() => setHoveredNode(node.id)}
                                onMouseLeave={() => setHoveredNode(null)}
                                onClick={() => handleNodeClick(node)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        handleNodeClick(node)
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Open section: ${node.section_title || node.label}`}
                                className="cursor-pointer transition-transform duration-300 hover:scale-105 focus:outline-none focus:[&_circle]:stroke-indigo-300"
                            >
                                <circle
                                    r={radius}
                                    className={`${getNodeColor(node)} ${getGlow(node)} transition-all duration-500`}
                                    strokeWidth="4"
                                />

                                <rect
                                    x="30"
                                    y="-14"
                                    width={labelWidth}
                                    height="28"
                                    rx="8"
                                    fill={isHovered || node.is_current ? 'rgba(15,23,42,0.96)' : 'rgba(15,23,42,0.78)'}
                                    stroke={node.is_current ? 'rgba(129,140,248,0.5)' : 'rgba(148,163,184,0.18)'}
                                />

                                <text
                                    x="42"
                                    y="5"
                                    fill={isHovered || node.is_current ? '#ffffff' : '#cbd5e1'}
                                    fontSize="13"
                                    fontWeight="600"
                                >
                                    {label}
                                </text>

                                {(isHovered || node.is_current) && (
                                    <g transform="translate(34, -52)">
                                        <rect
                                            x="0"
                                            y="0"
                                            width="162"
                                            height="42"
                                            rx="10"
                                            fill="rgba(30,41,59,0.96)"
                                            stroke="rgba(129,140,248,0.34)"
                                        />
                                        <text x="12" y="17" fill="#e2e8f0" fontSize="12" fontWeight="700">
                                            {node.section_title || 'Current section'}
                                        </text>
                                        <text x="12" y="32" fill="#94a3b8" fontSize="11">
                                            {describeNodeStatus(node)} / mastery {Number(node.p_known || 0).toFixed(2)}
                                        </text>
                                    </g>
                                )}
                            </g>
                        )
                    })}
                </svg>
            </div>
        </div>
    )
}
