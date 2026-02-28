import { useState } from 'react';
import { fuseTelemetry } from '../lib/knowledgeService';
import { logInteraction } from '../lib/loggingService';

export default function AffectiveReaction({ sectionId, conceptIds = [] }) {
    const [selected, setSelected] = useState(null);

    const reactions = [
        { id: 'affect_insight', emoji: '💡', label: 'Got it!', color: 'text-yellow-500', bg: 'bg-yellow-50' },
        { id: 'affect_engaged', emoji: '🤩', label: 'Interesting', color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { id: 'affect_confused', emoji: '🤔', label: 'Confusing', color: 'text-rose-500', bg: 'bg-rose-50' },
        { id: 'affect_disengaged', emoji: '🥱', label: 'Boring', color: 'text-slate-500', bg: 'bg-slate-50' }
    ];

    const handleSelect = async (reaction) => {
        if (selected === reaction.id) return;

        setSelected(reaction.id);
        logInteraction('affective_reaction', reaction.id, sectionId);

        // Attempt to dispatch to BKT Telemetry Fusion if we know the concepts
        if (conceptIds && conceptIds.length > 0) {
            try {
                // Focus on the primary concept
                await fuseTelemetry(conceptIds[0], reaction.id, 1.0);
                console.log(`Telemetry Fusion dispatched: ${reaction.id} for ${conceptIds[0]}`);
            } catch (err) {
                console.error("Failed to fuse telemetry", err);
            }
        }
    };

    return (
        <div className="flex flex-col items-center my-10 animate-fade-in">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
                How did you feel about this section?
            </h4>
            <div className="flex gap-4 p-2 bg-white rounded-full border border-slate-200 shadow-sm">
                {reactions.map((reaction) => {
                    const isSelected = selected === reaction.id;
                    return (
                        <button
                            key={reaction.id}
                            onClick={() => handleSelect(reaction)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-medium ${isSelected
                                    ? `${reaction.bg} ${reaction.color} shadow-inner ring-1 ring-black/5 scale-105`
                                    : 'text-slate-500 hover:bg-slate-50 hover:scale-105 hover:text-slate-700 grayscale-[0.5] hover:grayscale-0'
                                }`}
                            aria-label={reaction.label}
                        >
                            <span className="text-xl">{reaction.emoji}</span>
                            <span className={`text-sm ${isSelected ? 'block' : 'hidden md:block'} whitespace-nowrap`}>
                                {reaction.label}
                            </span>
                        </button>
                    )
                })}
            </div>
            {selected && (
                <p className="text-xs text-slate-400 mt-3 animate-fade-in">
                    Feedback saved. Your learning model has been updated.
                </p>
            )}
        </div>
    );
}
