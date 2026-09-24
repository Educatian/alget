import { useState } from 'react'
import { Key, X, Check, Eye, EyeOff } from 'lucide-react'
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../lib/browserStorage'

export default function SettingsModal({ isOpen, onClose }) {
    const [apiKey, setApiKey] = useState(() => safeLocalStorageGet('openrouter_api_key', ''))
    const [saved, setSaved] = useState(false)
    const [showKey, setShowKey] = useState(false)

    const handleSave = () => {
        if (apiKey.trim()) {
            safeLocalStorageSet('openrouter_api_key', apiKey.trim())
            setSaved(true)
            setTimeout(() => {
                onClose()
            }, 1000)
        } else {
            safeLocalStorageRemove('openrouter_api_key')
            setApiKey('')
            setSaved(true)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,6,8,0.52)] p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[var(--ath-line)] px-6 py-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--ath-text)]">
                        <Key className="h-5 w-5 text-[var(--ath-primary)]" />
                        API Settings
                    </h3>
                    <button type="button" onClick={onClose} className="text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-text)]">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    <label className="mb-2 block text-sm font-medium text-[var(--ath-text)]">
                        OpenRouter API Key
                    </label>
                    <p className="mb-4 text-xs leading-relaxed text-[var(--ath-muted)]">
                        Enter your OpenRouter API key to enable AI tutoring, scenario generation, and illustrations. The key is saved locally in this browser.
                    </p>

                    <div className="relative">
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-or-v1-..."
                            className="w-full rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-2 font-mono text-sm text-[var(--ath-text)] outline-hidden transition-all focus:border-[var(--ath-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ath-primary)_30%,transparent)]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ath-secondary)] hover:text-[var(--ath-text)]"
                        >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 bg-[var(--ath-panel-muted)] px-6 py-4">
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
                                <Check className="w-4 h-4" />
                                Saved
                            </>
                        ) : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
