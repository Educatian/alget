import { useState, useEffect } from 'react'
import { Key, X, Check, Eye, EyeOff } from 'lucide-react'

export default function SettingsModal({ isOpen, onClose }) {
    const [apiKey, setApiKey] = useState('')
    const [saved, setSaved] = useState(false)
    const [showKey, setShowKey] = useState(false)

    useEffect(() => {
        if (isOpen) {
            const stored = localStorage.getItem('gemini_api_key')
            if (stored) setApiKey(stored)
            setSaved(false)
            setShowKey(false)
        }
    }, [isOpen])

    const handleSave = () => {
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey.trim())
            setSaved(true)
            setTimeout(() => {
                onClose()
            }, 1000)
        } else {
            localStorage.removeItem('gemini_api_key')
            setApiKey('')
            setSaved(true)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-600" />
                        API Settings
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Google Gemini API Key
                    </label>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Enter your Gemini API key to enable AI features like Socratic tutoring, dynamic scenario generation, and image generation. This key is saved locally in your browser.
                    </p>

                    <div className="relative">
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all text-sm font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
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
