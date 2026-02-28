import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function KnowledgeGraph() {
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                // 1. Fetch user mastery from Supabase
                const { data: { session } } = await supabase.auth.getSession();
                const userId = session?.user?.id;

                let masteryMap = {};
                if (userId) {
                    const { data: masteryRecords } = await supabase
                        .from('mastery')
                        .select('concept_id, p_known')
                        .eq('user_id', userId);

                    if (masteryRecords) {
                        masteryRecords.forEach(record => {
                            masteryMap[record.concept_id] = record.p_known;
                        });
                    }
                }

                // 2. Fetch the graph topology from our new backend endpoint
                const response = await fetch('http://localhost:8000/api/mastery_graph', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mastery_data: masteryMap })
                });

                if (!response.ok) throw new Error("Failed to load graph data");
                const data = await response.json();

                // Add layout positions mechanically for our 6 hardcoded nodes
                const layedOutNodes = data.nodes.map(node => {
                    const positions = {
                        "ct_1_1": { x: 400, y: 100 },
                        "ct_1_2": { x: 250, y: 200 },
                        "ct_1_3": { x: 250, y: 350 },
                        "ct_2_1": { x: 550, y: 200 },
                        "ct_2_2": { x: 550, y: 300 },
                        "ct_2_3": { x: 550, y: 400 },
                    };
                    return { ...node, ...positions[node.id] };
                });

                setGraphData({ nodes: layedOutNodes, links: data.links });
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchGraph();
    }, []);

    if (loading) return <div className="text-center p-8 text-slate-500 animate-pulse">Loading Brain Network...</div>;
    if (error) return <div className="text-center p-8 text-red-500">Failed to load graph.</div>;
    if (!graphData) return null;

    const getNodeColor = (status) => {
        switch (status) {
            case 'mastered': return 'fill-emerald-500 stroke-emerald-200';
            case 'emerging': return 'fill-yellow-400 stroke-yellow-200';
            default: return 'fill-slate-300 stroke-slate-200';
        }
    };

    const getGlow = (status) => {
        if (status === 'mastered') return 'drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]';
        if (status === 'emerging') return 'drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]';
        return '';
    };

    return (
        <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl overflow-hidden relative border border-slate-700">
            <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                <span className="text-2xl">🧠</span> My Knowledge Graph
            </h3>
            <p className="text-slate-400 text-sm mb-6 max-w-md">
                Your real-time Bayesian Knowledge Trace. Nodes turn <span className="text-yellow-400 font-semibold px-1">yellow</span> as you begin to understand concepts, and <span className="text-emerald-400 font-semibold px-1">green</span> when mastered.
            </p>

            <div className="relative w-full h-[500px]">
                <svg width="100%" height="100%" viewBox="0 0 800 500" className="absolute inset-0">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Edges */}
                    {graphData.links.map((link, i) => {
                        const sourceNode = graphData.nodes.find(n => n.id === link.source);
                        const targetNode = graphData.nodes.find(n => n.id === link.target);
                        if (!sourceNode || !targetNode) return null;

                        const isHovered = hoveredNode === sourceNode.id || hoveredNode === targetNode.id;

                        return (
                            <line
                                key={i}
                                x1={sourceNode.x}
                                y1={sourceNode.y}
                                x2={targetNode.x}
                                y2={targetNode.y}
                                stroke={isHovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"}
                                strokeWidth={isHovered ? "3" : "1.5"}
                                className="transition-all duration-300"
                            />
                        )
                    })}

                    {/* Nodes */}
                    {graphData.nodes.map((node) => {
                        const isHovered = hoveredNode === node.id;

                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x},${node.y})`}
                                onMouseEnter={() => setHoveredNode(node.id)}
                                onMouseLeave={() => setHoveredNode(null)}
                                className="cursor-pointer transition-transform duration-300 hover:scale-110"
                            >
                                <circle
                                    r={node.status === 'mastered' ? 24 : node.status === 'emerging' ? 20 : 16}
                                    className={`${getNodeColor(node.status)} ${getGlow(node.status)} transition-all duration-500`}
                                    strokeWidth="4"
                                />

                                {/* Label background for readability */}
                                <rect
                                    x="30"
                                    y="-12"
                                    width={node.label.length * 8 + 20}
                                    height="24"
                                    rx="6"
                                    fill="rgba(15, 23, 42, 0.8)"
                                    className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-80'}`}
                                />

                                <text
                                    x="40"
                                    y="4"
                                    fill={isHovered ? "white" : "#94a3b8"}
                                    fontSize="14"
                                    fontWeight="600"
                                    className="transition-colors duration-300"
                                >
                                    {node.label}
                                </text>

                                {/* Hover Tooltip Data */}
                                {isHovered && (
                                    <g transform="translate(40, -25)" className="animate-fade-in">
                                        <rect x="-5" y="-15" width="60" height="20" rx="4" fill="#3b82f6" />
                                        <text x="0" y="0" fill="white" fontSize="12" fontWeight="bold">
                                            p: {node.p_known.toFixed(2)}
                                        </text>
                                    </g>
                                )}
                            </g>
                        )
                    })}
                </svg>
            </div>
        </div>
    );
}
