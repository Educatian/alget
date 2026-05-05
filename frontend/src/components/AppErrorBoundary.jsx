import { Component } from 'react'

export default class AppErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, errorMessage: '' }
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: error?.message || 'An unexpected rendering error occurred.'
        }
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ALGET UI] Render failure:', error, errorInfo)
    }

    handleReload = () => {
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="editorial-shell flex min-h-screen items-center justify-center px-4">
                    <div className="w-full max-w-xl rounded-[2rem] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-8 shadow-[var(--ath-shadow)] backdrop-blur-xl">
                        <p className="editorial-kicker">ALGET recovered from a render failure</p>
                        <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--ath-text)]">This screen did not load correctly</h1>
                        <p className="mt-4 text-sm leading-7 text-[var(--ath-muted)]">
                            Instead of showing a blank page, ALGET caught the runtime error and stopped the interface safely.
                        </p>
                        <div className="mt-6 rounded-2xl bg-[var(--ath-panel-muted)] px-4 py-3 text-sm text-[var(--ath-muted)]">
                            {this.state.errorMessage}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="rounded-2xl bg-[var(--ath-primary)] px-5 py-3 text-sm font-semibold text-[var(--ath-background)] transition-colors hover:brightness-105"
                            >
                                Reload page
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.href = '/'
                                }}
                                className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-5 py-3 text-sm font-semibold text-[var(--ath-muted)] transition-colors hover:bg-[var(--ath-panel)]"
                            >
                                Go to home
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
