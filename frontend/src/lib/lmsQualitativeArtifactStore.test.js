import { afterEach, describe, expect, it } from 'vitest'
import { activateLmsParticipant } from './lmsParticipantRoster'
import {
    LMS_QUALITATIVE_ARTIFACTS_KEY,
    buildLmsQualitativeExport,
    listLmsQualitativeArtifacts,
    saveLmsQualitativeArtifact,
    updateLmsQualitativeArtifact,
} from './lmsQualitativeArtifactStore'

afterEach(() => window.localStorage.clear())

describe('local qualitative artifact boundary', () => {
    it('stores full synthetic reason/revision/reflection separately from telemetry and exports it by scoped key', () => {
        const authUserId = 'synthetic-auth-participant-01'
        const input = {
            ownerAuthId: authUserId,
            participantId: 'participant-01',
            sessionId: 'synthetic-session-01',
            sectionId: 'inst-design/02/08',
            decision: 'modify',
            reasonText: 'The estimate is low, so I want a peer comparison before accepting the move.',
            modifiedProposalText: 'Add a peer evidence checkpoint before the final activity revision.',
            reflectionText: 'The evidence clarified the interaction choice but leaves transfer uncertain.',
            previousEvidence: { concepts: [{ concept_id: 'interaction_design', observed_score: 0.35 }] },
            followUp: { next_action: 'review_weakest_concept', result: 'pending' },
            synthetic: true,
        }
        const artifact = saveLmsQualitativeArtifact(input)
        expect(artifact).toMatchObject({ participant_id: 'participant-01', decision: 'modify', synthetic: true })
        expect(JSON.parse(window.localStorage.getItem(LMS_QUALITATIVE_ARTIFACTS_KEY))).toHaveLength(1)

        // Learner read is owner-scoped; a different account receives nothing.
        expect(listLmsQualitativeArtifacts({ requester: { id: authUserId }, participantId: 'participant-01' })).toHaveLength(1)
        expect(listLmsQualitativeArtifacts({ requester: { id: 'synthetic-auth-participant-02' }, participantId: 'participant-01' })).toEqual([])
        const exported = buildLmsQualitativeExport({ requester: { id: authUserId }, participantId: 'participant-01' })
        expect(exported[0]).toMatchObject({ reason_text: input.reasonText, modified_proposal_text: input.modifiedProposalText, reflection_text: input.reflectionText })
        expect(exported[0].owner_auth_id).toBeUndefined()
    })

    it('requires an authenticated roster binding for non-synthetic writes and updates follow-up without exposing owner IDs', () => {
        expect(() => saveLmsQualitativeArtifact({ participantId: 'participant-02', ownerAuthId: 'random-user', decision: 'accept', reasonText: 'Reason with enough detail.', reflectionText: 'Reflection with enough detail.' })).toThrow('lms_qualitative_forbidden')
        activateLmsParticipant({ participantId: 'participant-02', authUserId: 'auth-user-02' })
        const artifact = saveLmsQualitativeArtifact({ requester: { id: 'auth-user-02' }, participantId: 'participant-02', decision: 'accept', reasonText: 'I want to test retention first.', reflectionText: 'The observed estimate is encouraging but not conclusive.' })
        expect(() => updateLmsQualitativeArtifact(artifact.artifact_id, { requester: { id: 'wrong-user' }, ownerAuthId: 'wrong-user', followUp: { next_action: 'retention_check', result: 'opened' } })).toThrow('lms_qualitative_forbidden')
        expect(updateLmsQualitativeArtifact(artifact.artifact_id, { requester: { id: 'auth-user-02' }, followUp: { next_action: 'retention_check', result: 'queued' } })).toMatchObject({ follow_up: { next_action: 'retention_check', result: 'queued' } })
        expect(buildLmsQualitativeExport({ requester: { id: 'auth-user-02' }, participantId: 'participant-02' })[0].owner_auth_id).toBeUndefined()
    })
})
