import React from 'react';

export default function BiologyCard({ data }) {
  if (!data) return null;

  return (
    <div className="glass-panel p-6 mb-6 border-[var(--ath-line)] relative overflow-hidden group">
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--ath-primary)_10%,var(--ath-panel))] pointer-events-none"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-5 border-b border-[var(--ath-line)] pb-4">
          <div className="w-10 h-10 bg-[color-mix(in_srgb,var(--ath-primary)_12%,var(--ath-panel))] text-[var(--ath-primary)] rounded-lg flex items-center justify-center text-xl shadow-[inset_0_2px_4px_rgb(0,0,0,0.02)] border border-[var(--ath-line)]">
            🌿
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Biological Truth</h3>
        </div>

        <div className="space-y-5">
          <div>
            <h4 className="font-bold text-[var(--ath-primary)] text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Primary Mechanism
            </h4>
            <p className="text-slate-700 font-medium text-[15px]">{data.primary_mechanism}</p>
          </div>

          <div>
            <h4 className="font-bold text-[var(--ath-primary)] text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Explanation
            </h4>
            <p className="text-slate-600 leading-relaxed text-[15px]">{data.explanation}</p>
          </div>

          {data.organism_examples && data.organism_examples.length > 0 && (
            <div>
              <h4 className="font-bold text-[var(--ath-primary)] text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Organisms
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.organism_examples.map((org, index) => (
                  <span key={index} className="px-3 py-1.5 bg-[color-mix(in_srgb,var(--ath-primary)_12%,var(--ath-panel))] border border-[var(--ath-line)] shadow-sm text-[var(--ath-primary)] text-xs rounded-lg font-bold tracking-wide">
                    {org}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
