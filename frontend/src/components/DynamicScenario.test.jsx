import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import DynamicScenario from './DynamicScenario'

afterEach(() => cleanup())

describe('DynamicScenario curated bank', () => {
    it('renders a structured scenario with a generated visual panel without calling the API', () => {
        render(
            <DynamicScenario
                topic="Needs Analysis"
                context="A warehouse safety team asks for a compliance video before diagnosing the cause."
                course="inst-design"
            />,
        )

        expect(screen.getByText('Tailored case')).toBeInTheDocument()
        expect(screen.getByText('Needs Analysis')).toBeInTheDocument()
        expect(screen.getByText('Decision point')).toBeInTheDocument()
        expect(screen.getByText('Choose a move')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: /Needs Analysis scenario visual/i })).toBeInTheDocument()
        expect(screen.queryByText('AI Generated')).not.toBeInTheDocument()
    })

    it('can shuffle to another curated visual or case without leaving the card layout', () => {
        render(
            <DynamicScenario
                topic="Gecko Tape"
                context="A robot must grip and release without residue."
                course="bio-inspired"
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /Shuffle/i }))

        expect(screen.getByText('Scene')).toBeInTheDocument()
        expect(screen.getByText('Feedback')).toBeInTheDocument()
        expect(screen.getAllByRole('button').length).toBeGreaterThan(1)
    })

    it('renders nothing when no curated case matches the section', () => {
        const { container } = render(
            <DynamicScenario
                topic="Zxqv Nonsense"
                context="qwzzlptv unrelated gibberish"
                course="xyzzy"
            />,
        )

        expect(container).toBeEmptyDOMElement()
        expect(screen.queryByText('Tailored case')).not.toBeInTheDocument()
    })

    it('renders a live parametric torque sim for the engineering torque case', () => {
        render(
            <DynamicScenario
                topic="Torque and Moment Arm"
                context="A powered knee brace overheats; choose force or moment arm."
                course="dynamics"
            />,
        )

        // Labeled, keyboard-operable sliders that recompute a live result.
        const forceSlider = screen.getByLabelText(/Actuator force/i)
        expect(forceSlider).toHaveAttribute('type', 'range')
        expect(screen.getByLabelText(/Moment arm/i)).toBeInTheDocument()

        // The simulation's accessible description carries the live torque value,
        // and it must change when the learner drags the force slider.
        const sim = screen.getByRole('img', { name: /Torque on a powered joint/i })
        const before = sim.textContent
        fireEvent.change(forceSlider, { target: { value: '10' } })
        const after = sim.textContent
        expect(after).not.toBe(before)
        expect(after).toMatch(/newton metres/i)
    })
})
