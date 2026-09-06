import StackEffectDesigner from './StackEffectDesigner'
import UnityLabFrame from './UnityLabFrame'

const PINE_MORPH_URL = import.meta.env.VITE_PINEMORPH_UNITY_URL || 'https://pinemorph-lab-unity.pages.dev/'

export default function ThermalMorphingLabSuite() {
    return (
        <>
            <StackEffectDesigner />
            <UnityLabFrame
                sectionId="bio-inspired/06/01"
                simId="pinemorph"
                source="pinemorph-lab"
                src={PINE_MORPH_URL}
                title="PineMorph Lab — Design Passive Hygromorphic Motion"
                description="Use pine-cone-inspired bilayers to predict and test passive morphing, then justify a transfer design under environmental constraints."
            />
        </>
    )
}
