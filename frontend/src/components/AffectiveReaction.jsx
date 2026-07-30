import { useState } from 'react';
import { Brain, CircleHelp, Lightbulb, Moon } from 'lucide-react';
import { fuseTelemetry, recordAdaptiveSignal } from '../lib/knowledgeService';
import { logInteraction } from '../lib/loggingService';

export default function AffectiveReaction({ sectionId, conceptIds = [] }) {
    const [selected, setSelected] = useState(null);

    // Each affect maps to a semantic --ath-* token (no raw yellow/indigo/rose/
    // slate literals) so the bar inverts cleanly in dark mode. The soft tint is
    // derived from the same token via color-mix so selection reads as a calm,
    // on-brand wash rather than four unrelated Tailwind hues.
    const reactions = [
        { id: 'affect_insight', Icon: Lightbulb, label: 'Got it', color: 'text-[var(--ath-warning)]', bg: 'bg-[var(--ath-warning-soft)]' },
        { id: 'affect_engaged', Icon: Brain, label: 'Interesting', color: 'text-[var(--ath-info)]', bg: 'bg-[var(--ath-info-soft)]' },
        { id: 'affect_confused', Icon: CircleHelp, label: 'Confusing', color: 'text-[var(--ath-danger)]', bg: 'bg-[color-mix(in_srgb,var(--ath-danger)_14%,transparent)]' },
        { id: 'affect_disengaged', Icon: Moon, label: 'Boring', color: 'text-[var(--ath-muted)]', bg: 'bg-[var(--ath-panel-muted)]' }
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
        <div className="my-8 flex animate-fade-in flex-col items-center">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--ath-secondary)]">
                How did you feel about this section?
            </h4>
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
                {reactions.map((reaction) => {
                    const isSelected = selected === reaction.id;
                    const Icon = reaction.Icon;
                    return (
                        <button
                            key={reaction.id}
                            onClick={() => handleSelect(reaction)}
                            className={`flex min-h-11 items-center gap-2 rounded-full px-3.5 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] ${
                                isSelected
                                    ? `${reaction.bg} ${reaction.color} ring-1 ring-[var(--ath-line)]`
                                    : 'text-[var(--ath-muted)] hover:bg-[var(--ath-panel-muted)] hover:text-[var(--ath-text)]'
                            }`}
                            aria-label={reaction.label}
                        >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            <span className="whitespace-nowrap text-sm font-medium">
                                {reaction.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            {selected && (
                <p className="mt-3 animate-fade-in text-xs text-[var(--ath-secondary)]">
                    Feedback saved. Your learning model has been updated.
                </p>
            )}
        </div>
    );
}
