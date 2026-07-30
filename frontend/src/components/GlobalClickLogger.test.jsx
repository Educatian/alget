import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GlobalClickLogger from './GlobalClickLogger'
import { logClick, logPointerPath } from '../lib/loggingService'

vi.mock('../lib/loggingService', () => ({
    logClick: vi.fn(),
    logScroll: vi.fn(),
    logPointerPath: vi.fn(),
}))

function dispatchPointer(target, type, init) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.entries(init).forEach(([key, value]) => {
        Object.defineProperty(event, key, { value, enumerable: true })
    })
    target.dispatchEvent(event)
}

describe('GlobalClickLogger micro telemetry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('adds the route section id to clicks and sampled pointer paths', () => {
        render(
            <MemoryRouter initialEntries={['/book/cat100-supplement/01/01']}>
                <GlobalClickLogger>
                    <button type="button" data-testid="draw-surface">Draw</button>
                </GlobalClickLogger>
            </MemoryRouter>,
        )

        const surface = screen.getByTestId('draw-surface')

        fireEvent.click(surface, { clientX: 12, clientY: 18 })
        expect(logClick).toHaveBeenCalledWith(surface, 12, 18, 'cat100-supplement/01/01')

        dispatchPointer(surface, 'pointerdown', {
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            clientX: 20,
            clientY: 20,
        })
        dispatchPointer(surface, 'pointermove', {
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            clientX: 70,
            clientY: 82,
        })
        dispatchPointer(surface, 'pointerup', {
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            clientX: 92,
            clientY: 100,
        })

        expect(logPointerPath).toHaveBeenCalledWith(
            expect.objectContaining({
                target_id: 'draw-surface',
                distance_px: expect.any(Number),
                samples: expect.arrayContaining([
                    expect.objectContaining({ x: 20, y: 20 }),
                    expect.objectContaining({ x: 92, y: 100 }),
                ]),
            }),
            'cat100-supplement/01/01',
        )
    })
})
