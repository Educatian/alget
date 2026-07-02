import '@testing-library/jest-dom/vitest'

// jsdom implements no canvas/WebGL. The bio-inspired labs mount THREE.js /
// <model-viewer> / 2D-canvas visuals whose initialization throws in jsdom
// ("getContext not implemented", "Error creating WebGL context",
// model-viewer's renderer.xr.isPresenting on a null renderer). These are
// environment limitations, not product defects — the labs render in real
// browsers (verified live). Stub getContext + swallow the known WebGL-in-jsdom
// async noise so the lab tests run clean without masking real failures.
if (typeof HTMLCanvasElement !== 'undefined') {
    const noop = () => {}
    const ctx2d = new Proxy({}, { get: () => noop })
    const ctxGL = new Proxy(
        {},
        {
            get(_t, prop) {
                if (prop === 'getExtension') return () => null
                if (prop === 'getParameter') return () => 0
                if (prop === 'getShaderPrecisionFormat') return () => ({ rangeMin: 1, rangeMax: 1, precision: 1 })
                if (prop === 'canvas') return document.createElement('canvas')
                return noop
            },
        },
    )
    HTMLCanvasElement.prototype.getContext = function getContext(type) {
        if (type === '2d') return ctx2d
        if (typeof type === 'string' && type.includes('webgl')) return ctxGL
        return null
    }
}

// The lab animation loops (THREE / model-viewer) schedule RAF callbacks that can
// fire after a test unmounts and touch a null renderer in jsdom. Swallow ONLY
// those known WebGL/XR async messages; anything else propagates as before.
if (typeof process !== 'undefined' && process.on) {
    process.on('unhandledRejection', (reason) => {
        const msg = String(reason && reason.message ? reason.message : reason)
        if (/isPresenting|WebGL|getContext|renderer/i.test(msg)) return
        throw reason
    })
}
