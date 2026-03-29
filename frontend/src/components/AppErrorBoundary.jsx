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
                <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(158,27,50,0.08),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] flex items-center justify-center px-4">
                    <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#9E1B32]">ALGET recovered from a render failure</p>
                        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">This screen did not load correctly</h1>
                        <p className="mt-4 text-sm leading-7 text-slate-600">
                            Instead of showing a blank page, ALGET caught the runtime error and stopped the interface safely.
                        </p>
                        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            {this.state.errorMessage}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                            >
                                Reload page
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.href = '/'
                                }}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
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
