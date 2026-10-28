import { useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Type } from 'lucide-react'
import { DEFAULT_READER_PREFS, READER_OPTIONS, applyReaderPrefs, loadReaderPrefs, saveReaderPrefs } from '../lib/readerPrefs'
import { logEvent } from '../lib/loggingService'

const ROWS = [
    { key: 'size', label: 'Text size' },
    { key: 'leading', label: 'Line spacing' },
    { key: 'paragraph', label: 'Paragraph spacing' },
    { key: 'measure', label: 'Line width' },
    { key: 'font', label: 'Font' },
    { key: 'tracking', label: 'Letter spacing' },
]

/** "Aa" reader settings: typography choices for the reading column, saved in this browser. */
export default function ReaderSettings() {
    const [prefs, setPrefs] = useState(loadReaderPrefs)
    const [logged, setLogged] = useState(prefs)

    useEffect(() => {
        applyReaderPrefs(prefs)
        saveReaderPrefs(prefs)
        const changed = Object.keys(prefs).filter((k) => prefs[k] !== logged[k])
        if (changed.length) logEvent('reader_settings_change', changed.join(','), Object.fromEntries(changed.map((k) => [k, prefs[k]])))
        setLogged(prefs)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefs])

    const isDefault = Object.entries(DEFAULT_READER_PREFS).every(([k, v]) => prefs[k] === v)

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] text-[var(--ath-secondary)] shadow-sm transition-colors hover:border-[var(--ath-line-strong)] hover:bg-[var(--ath-panel-muted)] hover:text-[var(--ath-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ath-primary)]"
                    title="Reading settings"
                    aria-label="Reading settings: text size and spacing"
                >
                    <Type className="h-4 w-4" aria-hidden="true" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="bottom"
                    align="end"
                    sideOffset={12}
                    className="z-[90] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4 text-[var(--ath-text)] shadow-[var(--ath-shadow)]"
                >
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Reading settings</h2>
                        <button
                            type="button"
                            onClick={() => setPrefs({ ...DEFAULT_READER_PREFS })}
                            disabled={isDefault}
                            className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--ath-primary)] hover:bg-[var(--ath-panel-muted)] disabled:cursor-default disabled:text-[var(--ath-muted)] disabled:hover:bg-transparent"
                        >
                            Reset
                        </button>
                    </div>
                    <div className="space-y-3">
                        {ROWS.map(({ key, label }) => (
                            <fieldset key={key}>
                                <legend className="mb-1.5 text-xs font-semibold text-[var(--ath-muted)]">{label}</legend>
                                <div className="flex gap-1 rounded-xl bg-[var(--ath-panel-muted)] p-1">
                                    {READER_OPTIONS[key].map((option) => {
                                        const active = prefs[key] === option.id
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => setPrefs((p) => ({ ...p, [key]: option.id }))}
                                                className={`min-h-[36px] flex-1 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ath-primary)] ${active
                                                    ? 'bg-[var(--ath-panel)] text-[var(--ath-text)] shadow-sm'
                                                    : 'text-[var(--ath-muted)] hover:text-[var(--ath-text)]'}`}
                                                style={key === 'font' ? { fontFamily: option.value } : undefined}
                                            >
                                                {option.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </fieldset>
                        ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-4 text-[var(--ath-muted)]">Saved in this browser only.</p>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
