import { Component } from 'react'

/**
 * Block-level error boundary for the reading surface. Unlike AppErrorBoundary
 * (which replaces the whole screen), this contains a failure to a SINGLE
 * interactive/diagram block: if one lazy MDX component throws — bad authored
 * data, or (very common on the static Cloudflare deploy) a dynamic chunk that
 * 404s after a redeploy because its hashed URL changed — the rest of the
 * section keeps rendering and the reader is offered an inline retry/reload
 * instead of a white screen.
 */
export default class BlockErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, message: '' }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, message: error?.message || 'This element failed to load.' }
    }

    componentDidCatch(error, info) {
        console.warn('[ALGET] Reading block failed to render:', error, info)
    }

    handleRetry = () => {
        // Reset the boundary so children re-mount and the lazy import is retried.
        this.setState({ hasError: false, message: '' })
    }

    render() {
        if (this.state.hasError) {
            // A failed dynamic import (stale chunk after redeploy) typically
            // contains "Failed to fetch dynamically imported module" / "import".
            const isChunkError = /import|chunk|module/i.test(this.state.message)
            return (
                <div
                    role="alert"
                    className="reading-breakout my-6 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-5 py-4 text-sm text-[var(--ath-muted)]"
                >
                    <p className="font-semibold text-[var(--ath-text)]">
                        This interactive element could not be displayed.
                    </p>
                    <p className="mt-1 leading-6">
                        {isChunkError
                            ? 'A newer version of the textbook is available. Reload the page to load it.'
                            : 'The rest of the section is unaffected.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={this.handleRetry}
                            className="rounded-full border border-[var(--ath-line)] px-3 py-1 text-xs font-semibold text-[var(--ath-text)] transition-colors hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                        >
                            Try again
                        </button>
                        {isChunkError && (
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="rounded-full bg-[var(--ath-primary)] px-3 py-1 text-xs font-semibold text-[var(--ath-background)] transition-colors hover:brightness-105"
                            >
                                Reload page
                            </button>
                        )}
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}
