import { expect, test } from '@playwright/test'

const SCORE_RESPONSE = {
    validator_pass: true,
    policy_version: 'artifact-revision-scorer-v1',
    validation_errors: [],
    privacy: {
        raw_text_persisted: false,
        policy: 'score-derived-only-v1',
    },
    scores: {
        claim_clarity: 0.83,
        evidence_alignment: 0.78,
        revision_depth: 0.74,
        judgment_quality: 0.82,
        transfer_readiness: 0.7,
        specificity_delta: 0.76,
        overall_revision_quality: 0.79,
    },
}

const TRACE_VALIDATE_RESPONSE = {
    validator_pass: true,
    computed_trace_score: 8,
    computed_artifact_quality_score: 0.83,
    recommended_support_move: 'audit',
    normalized_rubric: {
        claim_visibility: 2,
        evidence_specificity: 2,
        support_boundary: 2,
        revision_quality: 2,
        rejection_rationale: 1,
        transfer_constraint: 1,
    },
    validation_errors: [],
    policy_version: 'artifact-trace-validator-v1',
}

const ADAPTIVE_RESPONSE = {
    primary_action: 'audit',
    recommended_because: [
        'The learner completed a revision trace with artifact trace completeness 1.0, evidence, AI judgment, and a transfer constraint.',
    ],
    evidence: [
        'artifact trace completeness: 1.0',
        'artifact revision quality: 0.79',
    ],
    learner_state: {
        artifact_trace_completeness: 1,
        artifact_quality_average: 0.79,
    },
    candidate_actions: [
        { action: 'explain', score: 0.2 },
        { action: 'compare', score: 0.5 },
        { action: 'audit', score: 0.91 },
    ],
}

async function installResearchApiMocks(page) {
    await page.route('**/api/research/artifact-revision/score', async (route) => {
        await route.fulfill({ json: SCORE_RESPONSE })
    })

    await page.route('**/api/research/artifact-trace/validate', async (route) => {
        await route.fulfill({ json: TRACE_VALIDATE_RESPONSE })
    })

    await page.route('**/api/adaptive_recommendation', async (route) => {
        await route.fulfill({ json: ADAPTIVE_RESPONSE })
    })
}

test.describe('ALGET full learner workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('alget_onboarding_completed_v1', 'done')
        })
    })

    test('supports annotation, artifact judgment, revision scoring, and adaptive rationale in one path', async ({ page }) => {
        const failures = []
        page.on('console', (message) => {
            const text = message.text()
            const allowedBrowserNoise = [
                'Failed to load resource: the server responded with a status of 404',
                'Permissions policy violation: compute-pressure is not allowed in this document.',
            ]
            if (message.type() === 'error' && !allowedBrowserNoise.some((allowed) => text.includes(allowed))) {
                failures.push(`console error: ${message.text()}`)
            }
        })
        page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))
        page.on('response', (response) => {
            const url = response.url()
            if (
                response.status() >= 400 &&
                (url.includes('127.0.0.1:5173') || url.includes('127.0.0.1:8000')) &&
                !url.endsWith('/favicon.ico')
            ) {
                failures.push(`response ${response.status()}: ${url}`)
            }
        })

        await installResearchApiMocks(page)
        await page.goto('/book/ail606-supplement/01/01', { waitUntil: 'networkidle' })

        // Annotations now collapsed — open via the Add note CTA in the bar
        await page.getByRole('button', { name: /Add note/i }).first().click()
        await page.getByRole('button', { name: 'Connection', exact: true }).click()
        await page.getByLabel(/^Note$/i).fill('This passage should connect the storyboard revision to cognitive load evidence.')
        await page.getByRole('button', { name: /^Post$/i }).click()
        await expect(page.getByText('This passage should connect the storyboard revision')).toBeVisible()

        // ArtifactStudio is now a 4-step wizard. Walk through each step.
        await expect(page.getByRole('button', { name: /Submission rules/i })).toBeVisible()

        // Step 1 - Draft
        await page.getByPlaceholder(/Paste or summarize the current draft/i).fill('The first storyboard draft lists media elements but does not name the learner audience or the design constraint.')
        await page.getByRole('button', { name: 'Next' }).first().click()

        // Step 2 - Evidence
        await page.getByPlaceholder(/Audience, constraint/i).fill('The storyboard should help novice teachers choose one multimedia segmenting move for a short lesson.')
        await page.getByPlaceholder(/Rubric line, annotation/i).fill('The evidence source is the section note on cognitive load and the annotation about segmenting the narration.')
        await page.getByRole('button', { name: 'Next' }).first().click()

        // Step 3 - Judge AI
        await page.getByPlaceholder(/What did you accept/i).fill('I accepted a suggestion to add a learner action note to the first storyboard frame.')
        await page.getByPlaceholder(/What did you reject or modify/i).fill('I rejected a suggestion that removed the evidence source because it made the revision impossible to audit.')
        await page.getByRole('button', { name: /^Modify$/i }).click()
        await page.getByPlaceholder(/Why this judgment/i).fill('The AI suggestion was modified because the revision needed to keep a visible theory-to-frame link.')
        await page.getByRole('button', { name: 'Next' }).first().click()

        // Step 4 - Revise
        await page.getByPlaceholder(/Paste or summarize the revised version/i).fill('The revised storyboard names novice teachers, marks the segmenting constraint, and adds a frame-level action note tied to cognitive load evidence.')
        await page.getByPlaceholder(/Where would this decision change next/i).fill('This decision would need to change for advanced learners who can process more simultaneous narration and visual detail.')

        await page.getByText(/Quality rubric/i).click()
        for (const select of await page.locator('details:has-text("Quality rubric") select').all()) {
            await select.selectOption('2')
        }

        await page.getByRole('button', { name: 'Submit' }).first().click()

        await expect(page.getByText(/Revision quality/i)).toBeVisible()
        await expect(page.getByText(/79%/)).toBeVisible()
        await expect(page.getByText(/Next: audit/i)).toBeVisible()

        expect(failures, failures.join('\n')).toEqual([])
    })
})
