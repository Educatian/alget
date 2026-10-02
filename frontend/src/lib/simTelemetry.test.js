import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

const logged = []
vi.mock('./loggingService', () => ({ logEvent: (type, target, data) => logged.push({ type, target, data }) }))

const { INPUT_SETTLE_MS, useIframeSimTelemetry } = await import('./simTelemetry')

const ORIGIN = 'https://geckogrip-lab-unity.pages.dev'
const frame = { contentWindow: {} }

function post(eventName, extra = {}) {
    window.dispatchEvent(new MessageEvent('message', {
        origin: ORIGIN,
        source: frame.contentWindow,
        data: { source: 'GeckoGripLab', type: 'learning-event', payload: { eventName, timestampUtc: `${Math.random()}`, ...extra } },
    }))
}

describe('useIframeSimTelemetry', () => {
    let received
    beforeEach(() => {
        vi.useFakeTimers()
        logged.length = 0
        received = []
        renderHook(() => useIframeSimTelemetry('04-01', 'geckogrip-unity', {
            iframeRef: { current: frame }, src: `${ORIGIN}/`, allowedSources: ['GeckoGripLab'], onEvent: (e) => received.push(e),
        }))
    })
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
    })

    it('keeps only the settled value of a dragged slider', () => {
        act(() => {
            for (let v = 30; v <= 40; v += 1) post('input_changed', { inputName: 'seta_angle_deg', inputValue: v })
        })
        expect(received).toHaveLength(0)
        act(() => { vi.advanceTimersByTime(INPUT_SETTLE_MS + 10) })
        const inputs = logged.filter((e) => e.type === 'sim_unity_input_changed')
        expect(inputs).toHaveLength(1)
        expect(inputs[0].data.input_value).toBe(40)
        expect(received.map((e) => e.type)).toEqual(['unity_input_changed'])
    })

    it('records pending input changes before the trial they belong to', () => {
        act(() => {
            post('input_changed', { inputName: 'preload_mn', inputValue: 8 })
            post('trial_completed', { opportunitiesCompleted: 1, opportunitiesAvailable: 4, prediction: 'SECURE GRIP' })
        })
        expect(received.map((e) => e.type)).toEqual(['unity_input_changed', 'unity_trial_completed'])
        expect(logged.filter((e) => e.type.startsWith('sim_unity')).map((e) => e.type))
            .toEqual(['sim_unity_input_changed', 'sim_unity_trial_completed'])
    })

    it('ignores messages from other origins or sources', () => {
        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: 'https://evil.example', source: frame.contentWindow,
                data: { source: 'GeckoGripLab', type: 'learning-event', payload: { eventName: 'trial_completed' } },
            }))
        })
        expect(received).toHaveLength(0)
    })
})
