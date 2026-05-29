import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/apiConfig'
import { getLocalMasteryMap } from '../lib/knowledgeService'

const VIEW_W = 540
const VIEW_H = 360

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
    //      toward the viewport center. ~140 ticks settles to a stable layout
    //      for ~40 nodes in well under 10ms.
    //   3. Re-translate so the focus node is centered in the viewBox.
    if (!nodes || nodes.length === 0) {
        return { nodes: [], width: VIEW_W, height: VIEW_H }
    }

    const cx = VIEW_W / 2
    const cy = VIEW_H / 2

    const focusIndex = (() => {
        const explicit = nodes.findIndex((node) => node.is_current)
        return explicit >= 0 ? explicit : 0
    })()

    const ringSpacing = 60
    const positioned = nodes.map((node, index) => {
        if (index === focusIndex) {
            return { ...node, x: cx, y: cy }
        }
        const ring = Math.max(1, node.section_order || 1)
        const radius = ringSpacing + (ring - 1) * 32
        const angle = ((index * 137.508) % 360) * (Math.PI / 180)
        return {
            ...node,
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
        }
    })

    const REPULSION = 700
    const LINK_LENGTH = 60
    const LINK_STRENGTH = 0.14
    const GRAVITY = 0.018
    const DAMPING = 0.82
    const TICKS = 160

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
                const distSq = Math.max(36, dx * dx + dy * dy)
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
            velocity[i].x = (velocity[i].x + force[i].x * 0.022) * DAMPING
            velocity[i].y = (velocity[i].y + force[i].y * 0.022) * DAMPING
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

    // Clamp positions inside viewBox with a small margin
    const margin = 24
    positioned.forEach((node) => {
        node.x = Math.max(margin, Math.min(VIEW_W - margin, node.x))
        node.y = Math.max(margin, Math.min(VIEW_H - margin, node.y))
    })

    return { nodes: positioned, width: VIEW_W, height: VIEW_H }
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
    const [dragging, setDragging] = useState(null) // node drag: { id, dx, dy, moved }
    const [panning, setPanning] = useState(null) // canvas pan: { startX, startY, originX, originY }
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const svgRef = useRef(null)
    const serializedCurrentConcepts = JSON.stringify(currentConceptIds)
    const navigate = useNavigate()

    const handleNodeClick = (node) => {
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
        // Convert from outer SVG coords to inner (zoomed/panned) coords
        return { x: (transformed.x - pan.x) / zoom, y: (transformed.y - pan.y) / zoom }
    }

    const handleNodeMouseDown = (event, node) => {
        event.preventDefault()
        event.stopPropagation()
        const point = screenToSvg(event)
        setDragging({ id: node.id, dx: point.x - node.x, dy: point.y - node.y, moved: false })
    }

    const handleSvgMouseDown = (event) => {
        // Pan when dragging on the empty canvas (not on a node).
        if (event.target === event.currentTarget || event.target.tagName === 'rect' || event.target.id === 'graph-grid-rect') {
            setPanning({ startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y })
        }
    }

    const handleSvgMouseMove = (event) => {
        if (panning) {
            setPan({
                x: panning.originX + (event.clientX - panning.startX),
                y: panning.originY + (event.clientY - panning.startY),
            })
            return
        }
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
        if (panning) setPanning(null)
    }

    const handleWheel = (event) => {
        event.preventDefault()
        const delta = event.deltaY > 0 ? 0.9 : 1.1
        setZoom((current) => Math.max(0.4, Math.min(3, current * delta)))
    }

    const resetView = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
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
                    setGraphData({ ...layout, links: data.links || [] })
                    setZoom(1)
                    setPan({ x: 0, y: 0 })
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
        return <div className="text-center p-6 motion-safe:animate-pulse text-xs" style={{ color: 'var(--ath-muted)' }}>Loading brain network…</div>
    }

    if (error) {
        return <div className="text-center p-6 text-xs" style={{ color: 'var(--ath-danger)' }}>Failed to load brain network.</div>
    }

    if (!graphData || graphData.nodes.length === 0) {
        return <div className="text-center p-6 text-xs" style={{ color: 'var(--ath-muted)' }}>No connected concepts found yet.</div>
    }

    // Status -> design token. focus=primary, mastered=success, emerging=warning,
    // unknown=muted. Strokes are a soft (tinted) ring of the same token so the
    // nodes read correctly in both light and dark themes.
    const getNodeFill = (node) => {
        if (node.is_current) return 'var(--ath-primary)'
        if (node.status === 'mastered') return 'var(--ath-success)'
        if (node.status === 'emerging') return 'var(--ath-warning)'
        return 'var(--ath-muted)'
    }
    const getNodeStroke = (node) => {
        if (node.is_current) return 'color-mix(in srgb, var(--ath-primary) 55%, transparent)'
        if (node.status === 'mastered') return 'color-mix(in srgb, var(--ath-success) 45%, transparent)'
        if (node.status === 'emerging') return 'color-mix(in srgb, var(--ath-warning) 45%, transparent)'
        return 'color-mix(in srgb, var(--ath-muted) 40%, transparent)'
    }
    const radiusFor = (node) => (node.is_current ? 11 : node.status === 'mastered' ? 9 : node.status === 'emerging' ? 8 : 7)

    const nodeCount = graphData.nodes.length
    const focusedChapterTitle = graphData.nodes[0]?.chapter_title || ''

    // O(1) node lookups for the link loop below (was O(nodes) find per link, i.e.
    // O(nodes*links) every render — and the graph re-renders on every pan/drag/hover).
    const nodesById = new Map(graphData.nodes.map((node) => [node.id, node]))

    return (
        <div className="knowledge-graph-mount rounded-2xl p-4 shadow-xl overflow-hidden relative" style={{ background: 'var(--ath-panel)', border: '1px solid var(--ath-line)' }}>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--ath-muted)' }}>
                <h3 className="mr-auto font-semibold text-sm" style={{ color: 'var(--ath-text)' }}>
                    Brain Network
                    {focusedChapterTitle && (
                        <span className="ml-1.5 font-medium" style={{ color: 'var(--ath-muted)' }}>· {focusedChapterTitle}</span>
                    )}
                </h3>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--ath-panel-muted)', color: 'var(--ath-muted)' }}>
                    {nodeCount} concept{nodeCount === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1" title="Current focus"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ath-primary)' }} />Focus</span>
                    <span className="inline-flex items-center gap-1" title="Developing"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ath-warning)' }} />Dev</span>
                    <span className="inline-flex items-center gap-1" title="Stable"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ath-success)' }} />Stable</span>
                    <span className="inline-flex items-center gap-1" title="Evidence needed"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ath-muted)' }} />Need</span>
                </div>
            </div>

            <div
                className="relative w-full overflow-hidden rounded-xl"
                style={{
                    border: '1px solid var(--ath-line)',
                    background: 'radial-gradient(circle at top, color-mix(in srgb, var(--ath-primary) 12%, transparent), transparent 40%), var(--ath-panel-muted)',
                }}
            >
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${graphData.width} ${graphData.height}`}
                    width="100%"
                    className={`block h-auto select-none ${dragging ? 'cursor-grabbing' : panning ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleSvgMouseDown}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseUp}
                    onWheel={handleWheel}
                    aria-label="Concept knowledge graph — drag to pan, scroll to zoom"
                >
                    <defs>
                        <pattern id="graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="color-mix(in srgb, var(--ath-muted) 18%, transparent)" strokeWidth="1" />
                        </pattern>
                    </defs>

                    {/* Background rect catches pan-drag clicks */}
                    <rect id="graph-grid-rect" width={graphData.width} height={graphData.height} fill="url(#graph-grid)" />

                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                        {graphData.links.map((link, index) => {
                            const sourceNode = nodesById.get(link.source)
                            const targetNode = nodesById.get(link.target)
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
                                    stroke={isHighlighted ? 'color-mix(in srgb, var(--ath-primary) 55%, transparent)' : 'color-mix(in srgb, var(--ath-muted) 22%, transparent)'}
                                    strokeWidth={isHighlighted ? 1.5 : 0.75}
                                />
                            )
                        })}

                        {graphData.nodes.map((node) => {
                            const isHovered = hoveredNode === node.id
                            const radius = radiusFor(node)
                            const label = node.label || humanizeLabel(node.id)
                            const showLabel = isHovered || node.is_current

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
                                    aria-label={`${label} · ${describeNodeStatus(node)}`}
                                    className={`${dragging?.id === node.id ? 'cursor-grabbing' : 'cursor-pointer'} focus:outline-none focus:[&_circle]:stroke-[var(--ath-primary)]`}
                                >
                                    <circle
                                        r={radius}
                                        fill={getNodeFill(node)}
                                        stroke={getNodeStroke(node)}
                                        strokeWidth={isHovered || node.is_current ? 2 : 1.25}
                                    />
                                    {showLabel && (
                                        <g transform={`translate(${radius + 4}, 4)`} pointerEvents="none">
                                            <rect
                                                x="-1"
                                                y="-10"
                                                width={Math.max(60, label.length * 5.4 + 10)}
                                                height="14"
                                                rx="3"
                                                fill="var(--ath-surface-strong)"
                                                stroke="var(--ath-line)"
                                            />
                                            <text x="4" y="0" fill="var(--ath-text)" fontSize="9" fontWeight="600">
                                                {label}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            )
                        })}
                    </g>
                </svg>

                {/* Zoom controls */}
                <div className="absolute right-2 top-2 flex flex-col gap-1 rounded-lg p-1 shadow-md backdrop-blur-sm" style={{ border: '1px solid var(--ath-line)', background: 'var(--ath-surface-strong)' }}>
                    <button
                        type="button"
                        onClick={() => setZoom((current) => Math.min(3, current * 1.2))}
                        title="Zoom in"
                        aria-label="Zoom in"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--ath-panel-muted)]"
                        style={{ color: 'var(--ath-muted)' }}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setZoom((current) => Math.max(0.4, current * 0.83))}
                        title="Zoom out"
                        aria-label="Zoom out"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--ath-panel-muted)]"
                        style={{ color: 'var(--ath-muted)' }}
                    >
                        <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={resetView}
                        title="Reset view"
                        aria-label="Reset zoom and pan"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--ath-panel-muted)]"
                        style={{ color: 'var(--ath-muted)' }}
                    >
                        <RotateCcw className="h-3 w-3" />
                    </button>
                </div>
                <div className="absolute left-2 bottom-2 rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ background: 'var(--ath-surface-strong)', color: 'var(--ath-muted)' }}>
                    drag · scroll to zoom
                </div>
            </div>
        </div>
    )
}
