import { useState } from 'react';
import { fuseTelemetry, recordAdaptiveSignal } from '../lib/knowledgeService';
import { logInteraction } from '../lib/loggingService';

export default function AffectiveReaction({ sectionId, conceptIds = [] }) {
    const [selected, setSelected] = useState(null);

    const reactions = [
        { id: 'affect_insight', symbol: 'IN', label: 'Got It!', color: 'text-yellow-500', bg: 'bg-yellow-50' },
        { id: 'affect_engaged', symbol: 'EN', label: 'Interesting', color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { id: 'affect_confused', symbol: 'CF', label: 'Confusing', color: 'text-rose-500', bg: 'bg-rose-50' },
        { id: 'affect_disengaged', symbol: 'BR', label: 'Boring', color: 'text-slate-500', bg: 'bg-slate-50' }
    ];

    const handleSelect = async (reaction) => {
        if (selected === reaction.id) return;

        setSelected(reaction.id);
        logInteraction('affective_reaction', reaction.id, sectionId);
        recordAdaptiveSignal(sectionId, reaction.id, { conceptId: conceptIds?.[0] || null });

        if (conceptIds && conceptIds.length > 0) {
            try {
                await fuseTelemetry(conceptIds[0], reaction.id, 1.0);
                console.log(`Telemetry Fusion dispatched: ${reaction.id} for ${conceptIds[0]}`);
            } catch (err) {
                console.error('Failed to fuse telemetry', err);
            }
        }
    };

    return (
        <div className="my-10 flex animate-fade-in flex-col items-center">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
                How did you feel about this section?
            </h4>
            <div className="flex gap-4 rounded-full border border-slate-200 bg-white p-2 shadow-sm">
                {reactions.map((reaction) => {
                    const isSelected = selected === reaction.id;
                    return (
                        <button
                            key={reaction.id}
                            onClick={() => handleSelect(reaction)}
                            className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-all duration-300 ${
                                isSelected
                                    ? `${reaction.bg} ${reaction.color} scale-105 shadow-inner ring-1 ring-black/5`
                                    : 'text-slate-500 grayscale-[0.5] hover:scale-105 hover:bg-slate-50 hover:text-slate-700 hover:grayscale-0'
                            }`}
                            aria-label={reaction.label}
                        >
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">{reaction.symbol}</span>
                            <span className={`whitespace-nowrap text-sm ${isSelected ? 'block' : 'hidden md:block'}`}>
                                {reaction.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            {selected && (
                <p className="mt-3 animate-fade-in text-xs text-slate-400">
                    Feedback saved. Your learning model has been updated.
                </p>
            )}
        </div>
    );
}
