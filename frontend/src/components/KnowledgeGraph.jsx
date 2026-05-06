import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/apiConfig'
import { getLocalMasteryMap } from '../lib/knowledgeService'

function humanizeLabel(value) {
    if (!value) return 'Untitled concept'
    return value
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase())
}

function buildLayout(nodes, links = []) {
    // Radial / force-directed layout — gives the chapter map a "social
    // network" constellation feel instead of a rigid grid. Steps:
    //
    //   1. Place all nodes on a polar seed (focus node at center; the rest
    //      around concentric rings keyed off section_order, with angle
    //      offset by concept_order so siblings fan out).
    //   2. Run a tiny vanilla force simulation (no d3 dependency): pairwise
    //      Coulomb repulsion + Hookean spring along links + gentle gravity
    //      toward the viewport center. ~120 ticks settles to a stable layout
    //      for ~40 nodes in well under 10ms.
    //   3. Re-translate so the focus node is centered in the viewBox.
    if (!nodes || nodes.length === 0) {
        return { nodes: [], width: 720, height: 540 }
    }

    const width = 760
    const height = 540
    const cx = width / 2
    const cy = height / 2

    const focusIndex = (() => {
        const explicit = nodes.findIndex((node) => node.is_current)
        return explicit >= 0 ? explicit : 0
    })()

    const ringSpacing = 110
    const positioned = nodes.map((node, index) => {
        if (index === focusIndex) {
            return { ...node, x: cx, y: cy }
        }
        const ring = Math.max(1, node.section_order || 1)
        const radius = ringSpacing + (ring - 1) * 70
        const angle = ((index * 137.508) % 360) * (Math.PI / 180)
        return {
            ...node,
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
        }
    })

    const REPULSION = 1900
    const LINK_LENGTH = 130
    const LINK_STRENGTH = 0.12
    const GRAVITY = 0.012
    const DAMPING = 0.84
    const TICKS = 140

    const linkList = (links || []).map((link) => {
        const sourceIdx = positioned.findIndex((node) => node.id === link.source)
        const targetIdx = positioned.findIndex((node) => node.id === link.target)
        return sourceIdx >= 0 && targetIdx >= 0 ? { sourceIdx, targetIdx } : null
    }).filter(Boolean)

    const velocity = positioned.map(() => ({ x: 0, y: 0 }))

    for (let step = 0; step < TICKS; step += 1) {
        const force = positioned.map(() => ({ x: 0, y: 0 }))

        for (let i = 0; i < positioned.length; i += 1) {
            for (let j = i + 1; j < positioned.length; j += 1) {
                const dx = positioned[i].x - positioned[j].x
                const dy = positioned[i].y - positioned[j].y
                const distSq = Math.max(64, dx * dx + dy * dy)
                const factor = REPULSION / distSq
                const fx = factor * dx
                const fy = factor * dy
                force[i].x += fx
                force[i].y += fy
                force[j].x -= fx
                force[j].y -= fy
            }
            force[i].x += (cx - positioned[i].x) * GRAVITY
            force[i].y += (cy - positioned[i].y) * GRAVITY
        }

        for (const { sourceIdx, targetIdx } of linkList) {
            const dx = positioned[targetIdx].x - positioned[sourceIdx].x
            const dy = positioned[targetIdx].y - positioned[sourceIdx].y
            const dist = Math.max(1, Math.hypot(dx, dy))
            const diff = (dist - LINK_LENGTH) / dist * LINK_STRENGTH
            force[sourceIdx].x += dx * diff * 0.5
            force[sourceIdx].y += dy * diff * 0.5
            force[targetIdx].x -= dx * diff * 0.5
            force[targetIdx].y -= dy * diff * 0.5
        }

        for (let i = 0; i < positioned.length; i += 1) {
            if (i === focusIndex) continue
            velocity[i].x = (velocity[i].x + force[i].x * 0.018) * DAMPING
            velocity[i].y = (velocity[i].y + force[i].y * 0.018) * DAMPING
            positioned[i].x += velocity[i].x
            positioned[i].y += velocity[i].y
        }
    }

    // Re-center on focus node after simulation drift
    const focusOffsetX = cx - positioned[focusIndex].x
    const focusOffsetY = cy - positioned[focusIndex].y
    positioned.forEach((node) => {
        node.x += focusOffsetX
        node.y += focusOffsetY
    })

    // Clamp final positions inside viewbox (with margin for label box)
    const margin = 140
    positioned.forEach((node) => {
        node.x = Math.max(margin, Math.min(width - margin, node.x))
        node.y = Math.max(60, Math.min(height - 60, node.y))
    })

    return { nodes: positioned, width, height }
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
    const [dragging, setDragging] = useState(null) // { id, dx, dy, moved }
    const svgRef = useRef(null)
    const serializedCurrentConcepts = JSON.stringify(currentConceptIds)
    const navigate = useNavigate()

    const handleNodeClick = (node) => {
        // node.section_id is the slug "course/chapter/section" emitted by
        // build_mastery_graph_payload. Treat the brain network as a
        // navigation surface: clicking a concept jumps to its section.
        // Suppress click-to-navigate when the node was dragged.
        if (dragging?.moved) return
        if (!node?.section_id) return
        navigate(`/book/${node.section_id}`)
    }

    const screenToSvg = (event) => {
        const svg = svgRef.current
        if (!svg) return { x: 0, y: 0 }
        const point = svg.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const ctm = svg.getScreenCTM()
        if (!ctm) return { x: 0, y: 0 }
        const transformed = point.matrixTransform(ctm.inverse())
        return { x: transformed.x, y: transformed.y }
    }

    const handleNodeMouseDown = (event, node) => {
        event.preventDefault()
        event.stopPropagation()
        const point = screenToSvg(event)
        setDragging({ id: node.id, dx: point.x - node.x, dy: point.y - node.y, moved: false })
    }

    const handleSvgMouseMove = (event) => {
        if (!dragging) return
        const point = screenToSvg(event)
        setGraphData((current) => {
            if (!current) return current
            return {
                ...current,
                nodes: current.nodes.map((node) =>
                    node.id === dragging.id
                        ? { ...node, x: point.x - dragging.dx, y: point.y - dragging.dy }
                        : node
                ),
            }
        })
        if (!dragging.moved) setDragging((current) => current && { ...current, moved: true })
    }

    const handleSvgMouseUp = () => {
        if (dragging) setDragging(null)
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

                const masteryMap = { ...getLocalMasteryMap() }
                if (userId) {
                    const { data: masteryRecords, error: masteryError } = await supabase
                        .from('mastery')
                        .select('concept_id, p_known, mastery_score')
                        .eq('user_id', userId)

                    if (masteryError) {
                        console.warn('[KnowledgeGraph] Supabase mastery fetch failed; using local mastery:', masteryError)
                    } else if (masteryRecords) {
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
                const layout = buildLayout(data.nodes || [], data.links || [])

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

    const nodeCount = graphData.nodes.length
    const focusedChapterTitle = graphData.nodes[0]?.chapter_title || ''

    return (
        <div className="knowledge-graph-mount bg-slate-950 rounded-3xl p-6 shadow-2xl overflow-hidden relative border border-slate-800">
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <h3 className="mr-auto text-white font-bold text-base">
                    Brain Network
                    {focusedChapterTitle && (
                        <span className="ml-2 text-xs font-medium text-slate-400">/ {focusedChapterTitle}</span>
                    )}
                </h3>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {nodeCount} concept{nodeCount === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5" title="Current focus"><span className="h-2 w-2 rounded-full bg-indigo-500" />Focus</span>
                    <span className="inline-flex items-center gap-1.5" title="Developing"><span className="h-2 w-2 rounded-full bg-amber-400" />Developing</span>
                    <span className="inline-flex items-center gap-1.5" title="Stable"><span className="h-2 w-2 rounded-full bg-emerald-500" />Stable</span>
                    <span className="inline-flex items-center gap-1.5" title="Evidence needed"><span className="h-2 w-2 rounded-full bg-slate-400" />Needs evidence</span>
                </div>
                <span className="hidden text-[11px] text-slate-500 sm:inline" title="Click a node to jump / color = how much usable evidence the system has, not a grade">
                    Click a node to jump
                </span>
            </div>

            <div className="relative w-full overflow-x-auto rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
                <svg
                    ref={svgRef}
                    width="100%"
                    height="540"
                    viewBox={`0 0 ${graphData.width} ${graphData.height}`}
                    className={`min-w-[860px] ${dragging ? 'cursor-grabbing' : ''}`}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseUp}
                >
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
                                onMouseDown={(event) => handleNodeMouseDown(event, node)}
                                onClick={() => handleNodeClick(node)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        handleNodeClick(node)
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Open section: ${node.section_title || node.label} (drag to reposition)`}
                                className={`${dragging?.id === node.id ? 'cursor-grabbing' : 'cursor-grab'} transition-transform duration-300 hover:scale-105 focus:outline-none focus:[&_circle]:stroke-indigo-300`}
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
