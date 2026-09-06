import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GuidedSimulationLab from './GuidedSimulationLab'
import { logSimEvent } from '../lib/simTelemetry'
import { summarizeGuideText } from '../lib/guidedSimulationTelemetry'

vi.mock('../lib/simTelemetry', () => ({ logSimEvent: vi.fn() }))
vi.mock('./UnityLabFrame', () => ({
    default: ({ title }) => <div data-testid="unity-lab-frame">{title}</div>,
}))

describe('GuidedSimulationLab', () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(cleanup)

    it('summarizes writing without returning learner-authored text', () => {
        expect(summarizeGuideText('')).toEqual({ completed: false, length_band: 'empty' })
        expect(summarizeGuideText('a private prediction')).toEqual({ completed: true, length_band: 'brief' })
        expect(Object.values(summarizeGuideText('private answer')).join(' ')).not.toContain('private answer')
    })

    it('keeps response text local and logs only privacy-safe completion features', () => {
        render(<GuidedSimulationLab lab="fingrip" sectionId="bio-inspired/01/01" />)

        const [prediction, reflection, transfer] = screen.getAllByRole('textbox')
        fireEvent.change(prediction, { target: { value: 'My private mechanism prediction' } })
        fireEvent.click(screen.getByRole('button', { name: /save prediction for this session/i }))

        expect(logSimEvent).toHaveBeenCalledWith(
            'bio-inspired/01/01',
            'fingrip',
            'guide_prediction_saved',
            { completed: true, length_band: 'brief' },
        )
        expect(JSON.stringify(logSimEvent.mock.calls)).not.toContain('My private mechanism prediction')

        fireEvent.change(reflection, { target: { value: 'Private reflection evidence' } })
        fireEvent.change(transfer, { target: { value: 'Private transfer design' } })
        fireEvent.click(screen.getByRole('button', { name: /save reflection for this session/i }))

        expect(JSON.stringify(logSimEvent.mock.calls)).not.toContain('Private reflection evidence')
        expect(JSON.stringify(logSimEvent.mock.calls)).not.toContain('Private transfer design')
        expect(sessionStorage.getItem('alget:guided-sim-session:v1:bio-inspired/01/01:fingrip')).toContain('Private reflection evidence')
    })
})
