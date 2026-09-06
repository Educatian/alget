import RelativeDensityExplorer from './RelativeDensityExplorer'
import UnityLabFrame from './UnityLabFrame'

const FIN_GRIP_URL = import.meta.env.VITE_FINGRIP_UNITY_URL || 'https://fingrip-lab-unity.pages.dev/'
const TRABECULA_URL = import.meta.env.VITE_TRABECULA_UNITY_URL

export default function StructuralBiomimicryLabSuite() {
    return (
        <>
            <RelativeDensityExplorer />
            <UnityLabFrame
                sectionId="bio-inspired/01/01"
                simId="fingrip"
                source="FinGripLab"
                src={FIN_GRIP_URL}
                title="FinGrip Lab — Tune a Compliant Bio-Inspired Gripper"
                description="Predict, test, and redesign a compliant gripper while balancing grasp force, damage risk, and manufacturability."
            />
            {TRABECULA_URL && (
                <UnityLabFrame
                    sectionId="bio-inspired/01/01"
                    simId="trabecula"
                    source="TrabeculaLab"
                    src={TRABECULA_URL}
                    title="Trabecula Lab — Align Material with Load Paths"
                    description="Investigate trabecular orientation, density, bracing, and loading, then transfer the load-path principle to a new structure."
                />
            )}
        </>
    )
}
