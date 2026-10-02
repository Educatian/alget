// The four Unity simulation labs for the bio-inspired research track.
// Participants choose ONE. Steps and goals were written from each lab's own
// guided tour and on-screen limits; the labs themselves are separate Unity
// WebGL builds (hosts can be overridden with VITE_*_UNITY_URL).

export const SIM_LAB_TIME = 'About 30–60 minutes, at your own pace. Your progress is saved.'

export const SIM_LABS = [
    {
        id: 'fingrip',
        simId: 'fingrip',
        source: 'FinGripLab',
        sectionId: '01-01',
        url: import.meta.env.VITE_FINGRIP_UNITY_URL || 'https://fingrip-lab-unity.pages.dev/',
        title: 'FinGrip Lab',
        tagline: 'Design a soft robotic gripper, inspired by fish fins, that holds a tomato without crushing or dropping it.',
        requiredTrials: 5,
        trialWord: 'test',
        goal: 'Keep peak pressure at or below 122 kPa and slip at or below 2 mm.',
        steps: [
            'Follow or skip the short tour. The ? button at the top right replays it.',
            'Click INSPECT MECHANISM first. The prediction buttons stay grey until you do.',
            'Set the three sliders: material compliance, rib angle, and fruit surface grip.',
            'Predict the outcome: PASS, DAMAGE, or SLIP.',
            'Press RUN TEST and wait for the result. Compare peak pressure and slip with their limits.',
            'Change one slider at a time, predict again, and run the next test until you have run 5 tests.',
        ],
    },
    {
        id: 'trabecula',
        simId: 'trabecula',
        source: 'TrabeculaLab',
        sectionId: '01-01',
        url: import.meta.env.VITE_TRABECULA_UNITY_URL || 'https://trabecula-lab-unity.pages.dev/',
        title: 'Trabecula Lab',
        tagline: 'Arrange a lightweight, bone-like lattice so it carries a load without bending too far or buckling.',
        requiredTrials: 5,
        trialWord: 'guided trial',
        goal: 'Deformation at or below 0.6 mm, buckling risk below 0.67, mass at or below 30 g, and a safety factor of at least 1.5.',
        steps: [
            'Read the banner above the model. It names the focus of each guided trial (1 of 5 to 5 of 5).',
            'Adjust the design sliders on the left (strut orientation, density, member thickness, cross-bracing, load, and load offset).',
            'Choose a prediction (DEFLECT, BUCKLE, or PASS) and set how confident you are.',
            'Press RUN GUIDED TRIAL and compare the Live Analysis values with the limits shown beside them.',
            'Drag to rotate the model, scroll to zoom, and click a member to inspect its load path.',
            'Repeat until you have run all 5 guided trials. The Claim, Evidence, Reasoning boxes are optional practice and are not saved.',
        ],
    },
    {
        id: 'geckogrip',
        simId: 'geckogrip-unity',
        source: 'GeckoGripLab',
        sectionId: '04-01',
        url: import.meta.env.VITE_GECKOGRIP_UNITY_URL || 'https://geckogrip-lab-unity.pages.dev/',
        title: 'GeckoGrip Lab',
        tagline: 'Tune a gecko-style dry adhesive pad that holds firmly but still lets go easily.',
        requiredTrials: 4,
        trialWord: 'trial',
        goal: 'Carry a 1.2 N load and release below 0.20 N, with at least 55% real contact and a safety factor of at least 1.35.',
        steps: [
            'Read the 4-step introduction (NEXT), or SKIP it. The ? button at the top right replays it.',
            'Set the three design inputs: seta angle, preload, and surface roughness.',
            'Predict the outcome: CONTACT LOSS, SLIP RISK, HARD RELEASE, or SECURE GRIP.',
            'Press RUN LOAD TEST and read the Mechanics Evidence panel (real contact, shear capacity, release force).',
            'Change one input at a time, predict again, and run the next trial until you have run 4 trials.',
        ],
    },
    {
        id: 'pinemorph',
        simId: 'pinemorph',
        source: 'pinemorph-lab',
        sectionId: '06-01',
        url: import.meta.env.VITE_PINEMORPH_UNITY_URL || 'https://pinemorph-lab-unity.pages.dev/',
        title: 'PineMorph Lab',
        tagline: 'Design a two-layer material that opens like a pine cone when the humidity changes.',
        requiredTrials: 5,
        trialWord: 'test',
        goal: 'Open between 45° and 75°, respond within 180 seconds, and keep peak stress at or below 3.5 MPa.',
        steps: [
            'Work through the guided introduction. Press EXPLORE, then follow the instruction in the banner above the model.',
            'Drag to rotate the model, scroll to zoom, and press R to reset the view.',
            'Set the three design inputs: active layer, stiffness ratio, and fiber angle.',
            'Predict the limiting outcome: UNDER-OPENS, BALANCED, OVER-OPENS, TOO SLOW, or OVER-STRESS.',
            'Press RUN TEST and compare opening angle, response time, and peak stress with their limits.',
            'Change one input at a time, predict again, and run the next test until you have run 5 tests.',
        ],
    },
]

export function getSimLab(id) {
    return SIM_LABS.find((lab) => lab.id === id) || null
}
