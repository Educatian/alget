import { describe, expect, it } from 'vitest'
import { serrationModel } from './SerrationOptimizer'
import { stackModel } from './StackEffectDesigner'
import { cellularModel } from './RelativeDensityExplorer'
import { peelModel } from './PeelAsymmetryExplorer'
import { braggModel } from './BraggColorDesigner'
import { healingModel } from './CapsuleHealingExplorer'

describe('serrationModel physics', () => {
    const base = { speed: 30, spacingMm: 8, depthMm: 12, teeth: 30 }

    it('finer spacing raises the shedding tone (f = St·U/λ)', () => {
        const wide = serrationModel({ ...base, spacingMm: 16 }).toneHz
        const fine = serrationModel({ ...base, spacingMm: 2 }).toneHz
        expect(fine).toBeGreaterThan(wide)
    })

    it('more teeth increase de-correlation reduction', () => {
        const few = serrationModel({ ...base, teeth: 10 }).reductionDb
        const many = serrationModel({ ...base, teeth: 90 }).reductionDb
        expect(many).toBeGreaterThan(few)
    })

    it('higher flow speed raises the baseline dipole level (U^6)', () => {
        const slow = serrationModel({ ...base, speed: 10 }).baselineDb
        const fast = serrationModel({ ...base, speed: 50 }).baselineDb
        expect(fast).toBeGreaterThan(slow)
    })
})

describe('stackModel physics', () => {
    const base = { height: 6, tInC: 34, tOutC: 26, ventArea: 1.2, massKg: 12000, swingC: 12 }

    it('a warmer interior drives positive stack pressure', () => {
        expect(stackModel(base).deltaP).toBeGreaterThan(0)
    })

    it('no buoyancy when interior is not warmer than outside', () => {
        const m = stackModel({ ...base, tInC: 24, tOutC: 30 })
        expect(m.deltaP).toBe(0)
        expect(m.ach).toBe(0)
    })

    it('taller stack and bigger vents raise air changes', () => {
        const low = stackModel({ ...base, height: 2 }).ach
        const tall = stackModel({ ...base, height: 14 }).ach
        expect(tall).toBeGreaterThan(low)
        const small = stackModel({ ...base, ventArea: 0.4 }).ach
        const big = stackModel({ ...base, ventArea: 3.5 }).ach
        expect(big).toBeGreaterThan(small)
    })

    it('thermal storage scales with mass (E = m·c·ΔT)', () => {
        const light = stackModel({ ...base, massKg: 2000 }).storageMJ
        const heavy = stackModel({ ...base, massKg: 40000 }).storageMJ
        expect(heavy).toBeGreaterThan(light)
    })
})

describe('cellularModel (Gibson-Ashby)', () => {
    it('stiffness rises with relative density (square law)', () => {
        const lo = cellularModel({ density: 0.15, closedFraction: 0.4 }).stiffness
        const hi = cellularModel({ density: 0.5, closedFraction: 0.4 }).stiffness
        expect(hi).toBeGreaterThan(lo)
    })
    it('porosity falls as density rises', () => {
        expect(cellularModel({ density: 0.1, closedFraction: 0 }).porosity).toBeGreaterThan(
            cellularModel({ density: 0.6, closedFraction: 0 }).porosity,
        )
    })
})

describe('peelModel (Kendall)', () => {
    it('shallow peel angle holds far more than a steep one', () => {
        const base = { workAdhesion: 0.6, width: 0.6 }
        expect(peelModel({ ...base, angleDeg: 8 }).force).toBeGreaterThan(
            peelModel({ ...base, angleDeg: 90 }).force,
        )
    })
    it('grip:release ratio exceeds 1 at a shallow angle', () => {
        expect(peelModel({ angleDeg: 8, workAdhesion: 0.6, width: 0.6 }).gripToRelease).toBeGreaterThan(1)
    })
})

describe('braggModel (multilayer interference)', () => {
    it('thicker layers push the peak to longer wavelengths', () => {
        const thin = braggModel({ cuticleNm: 50, airNm: 60, cuticleIndex: 1.5, viewAngle: 0 }).peak
        const thick = braggModel({ cuticleNm: 140, airNm: 180, cuticleIndex: 1.5, viewAngle: 0 }).peak
        expect(thick).toBeGreaterThan(thin)
    })
    it('tilting the view blue-shifts the observed peak', () => {
        const m = braggModel({ cuticleNm: 70, airNm: 120, cuticleIndex: 1.56, viewAngle: 50 })
        expect(m.observed).toBeLessThan(m.peak)
    })
})

describe('healingModel (capsule triggering)', () => {
    it('smaller capsules give more crack intersections (hits ∝ 1/d²)', () => {
        const big = healingModel({ fraction: 0.1, diameterUm: 300, crackSize: 0.5 }).expectedHits
        const small = healingModel({ fraction: 0.1, diameterUm: 60, crackSize: 0.5 }).expectedHits
        expect(small).toBeGreaterThan(big)
    })
    it('higher capsule loading weakens the matrix', () => {
        const light = healingModel({ fraction: 0.05, diameterUm: 120, crackSize: 0.5 }).matrixIntegrity
        const heavy = healingModel({ fraction: 0.22, diameterUm: 120, crackSize: 0.5 }).matrixIntegrity
        expect(heavy).toBeLessThan(light)
    })
})
