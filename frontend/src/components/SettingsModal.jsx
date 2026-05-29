import { useState } from 'react'
import { Key, X, Check, Eye, EyeOff, BookOpen, RotateCcw } from 'lucide-react'
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../lib/browserStorage'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useTheme } from '../lib/themeContext'
import {
    FONT_SCALE_OPTIONS,
    LINE_HEIGHT_OPTIONS,
    PARAGRAPH_SPACING_OPTIONS,
    READING_WIDTH_OPTIONS,
    DYSLEXIA_FONT_OPTIONS
} from '../lib/readingPrefs'

/**
 * A segmented control rendered as a radiogroup so the active choice is
 * announced to assistive technology (WCAG 4.1.2 Name, Role, Value).
 */
function SegmentedControl({ label, name, options, value, onChange, getOptionLabel, getOptionValue }) {
    return (
        <div role="group" aria-label={label}>
            <p className="mb-2 text-sm font-medium text-[var(--ath-text)]">{label}</p>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const optValue = getOptionValue(option)
                    const optLabel = getOptionLabel(option)
                    const selected = optValue === value
                    return (
                        <button
                            key={String(optValue)}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange(optValue)}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                selected
                                    ? 'border-[var(--ath-primary)] bg-[color-mix(in_srgb,var(--ath-primary)_14%,transparent)] text-[var(--ath-text)]'
                                    : 'border-[var(--ath-line)] text-[var(--ath-muted)] hover:text-[var(--ath-text)]'
                            }`}
                        >
                            {optLabel}
                        </button>
                    )
                })}
            </div>
            {/* hidden inputs keep the control associated with a logical form name */}
            <input type="hidden" name={name} value={String(value)} readOnly />
        </div>
    )
}

export default function SettingsModal({ isOpen, onClose }) {
    const [apiKey, setApiKey] = useState(() => safeLocalStorageGet('gemini_api_key', ''))
    const [saved, setSaved] = useState(false)
    const [showKey, setShowKey] = useState(false)

    const { readingPrefs, setReadingPref, resetReadingPrefs } = useTheme()
    const dialogRef = useFocusTrap(isOpen, onClose)

    const handleSave = () => {
        if (apiKey.trim()) {
            safeLocalStorageSet('gemini_api_key', apiKey.trim())
            setSaved(true)
            setTimeout(() => {
                onClose()
            }, 1000)
        } else {
            safeLocalStorageRemove('gemini_api_key')
            setApiKey('')
            setSaved(true)
        }
    }

    if (!isOpen) return null

    return (
        // Backdrop click dismisses the dialog. The keyboard-equivalent
        // dismissal (Escape) is handled by useFocusTrap, so a key handler on
        // this presentational overlay would be redundant.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,6,8,0.52)] p-4 backdrop-blur-sm"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-modal-title"
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-2xl sm:max-w-lg"
            >
                <div className="flex items-center justify-between border-b border-[var(--ath-line)] px-6 py-4">
                    <h3 id="settings-modal-title" className="flex items-center gap-2 text-lg font-semibold text-[var(--ath-text)]">
                        <Key className="h-5 w-5 text-[var(--ath-primary)]" />
                        Settings
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close settings dialog"
                        className="text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-text)]"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="p-6">
                    <label htmlFor="gemini-api-key" className="mb-2 block text-sm font-medium text-[var(--ath-text)]">
                        Google Gemini API Key
                    </label>
                    <p className="mb-4 text-xs leading-relaxed text-[var(--ath-muted)]">
                        Enter your Gemini API key to enable AI features like Socratic tutoring, dynamic scenario generation, and image generation. This key is saved locally in your browser.
                    </p>

                    <div className="relative">
                        <input
                            id="gemini-api-key"
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-2 font-mono text-sm text-[var(--ath-text)] outline-hidden transition-all focus:border-[var(--ath-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ath-primary)_30%,transparent)]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            aria-label={showKey ? 'Hide API key' : 'Show API key'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ath-secondary)] hover:text-[var(--ath-text)]"
                        >
                            {showKey ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                        </button>
                    </div>
                </div>

                <div className="border-t border-[var(--ath-line)] p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--ath-text)]">
                            <BookOpen className="h-4 w-4 text-[var(--ath-primary)]" aria-hidden="true" />
                            Reading Preferences
                        </h4>
                        <button
                            type="button"
                            onClick={resetReadingPrefs}
                            className="flex items-center gap-1 text-xs font-medium text-[var(--ath-muted)] transition-colors hover:text-[var(--ath-text)]"
                        >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            Reset
                        </button>
                    </div>
                    <p className="mb-5 text-xs leading-relaxed text-[var(--ath-muted)]">
                        Customize how text appears across the app. Changes apply instantly and are saved in your browser.
                    </p>

                    <div className="space-y-4">
                        <SegmentedControl
                            label="Text size"
                            name="reading_font_scale"
                            options={FONT_SCALE_OPTIONS}
                            value={readingPrefs.fontScale}
                            onChange={(v) => setReadingPref('fontScale', v)}
                            getOptionValue={(o) => o.value}
                            getOptionLabel={(o) => o.label}
                        />
                        <SegmentedControl
                            label="Line spacing"
                            name="reading_line_height"
                            options={LINE_HEIGHT_OPTIONS}
                            value={readingPrefs.lineHeight}
                            onChange={(v) => setReadingPref('lineHeight', v)}
                            getOptionValue={(o) => o.value}
                            getOptionLabel={(o) => o.label}
                        />
                        <SegmentedControl
                            label="Paragraph spacing"
                            name="reading_paragraph_spacing"
                            options={PARAGRAPH_SPACING_OPTIONS}
                            value={readingPrefs.paragraphSpacing}
                            onChange={(v) => setReadingPref('paragraphSpacing', v)}
                            getOptionValue={(o) => o.value}
                            getOptionLabel={(o) => o.label}
                        />
                        <SegmentedControl
                            label="Reading width"
                            name="reading_width"
                            options={READING_WIDTH_OPTIONS}
                            value={readingPrefs.readingWidth}
                            onChange={(v) => setReadingPref('readingWidth', v)}
                            getOptionValue={(o) => o.value}
                            getOptionLabel={(o) => o.label}
                        />
                        <SegmentedControl
                            label="Dyslexia-friendly font"
                            name="reading_dyslexia_font"
                            options={DYSLEXIA_FONT_OPTIONS}
                            value={readingPrefs.dyslexiaFont}
                            onChange={(v) => setReadingPref('dyslexiaFont', v)}
                            getOptionValue={(o) => o.value}
                            getOptionLabel={(o) => o.label}
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-[var(--ath-muted)] transition-colors hover:text-[var(--ath-text)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex items-center gap-2 rounded-lg bg-[var(--ath-primary)] px-4 py-2 text-sm font-medium text-[var(--ath-background)] transition-colors hover:brightness-105"
                    >
                        {saved ? (
                            <>
                                <Check className="w-4 h-4" aria-hidden="true" />
                                Saved
                            </>
                        ) : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
