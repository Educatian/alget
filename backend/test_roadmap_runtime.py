import unittest

from roadmap_runtime import (
    ModelRegistry,
    apply_privacy_deletion,
    build_case_competency,
    build_evaluation_manifest,
    build_lti13_context,
    build_privacy_deletion_plan,
    build_privacy_export,
    build_runtime_package,
    create_incident,
    normalize_oneroster_users,
    record_agent_decision,
    summarize_social_outcomes,
    to_caliper_event,
    transition_incident,
    validate_runtime_package,
)


class RoadmapRuntimeTests(unittest.TestCase):
    def package(self):
        return build_runtime_package(
            course_id="ail-606",
            source_text="Evidence evaluation compares a claim with a source.",
            source={"title": "Course source", "canonical_url": "https://example.edu/source"},
            sections=[
                {
                    "id": "01/01",
                    "title": "Evidence evaluation",
                    "reading": {"content": "Compare a claim with its source."},
                    "references": [{"title": "Source", "url": "https://example.edu/source"}],
                }
            ],
        )

    def test_runtime_package_is_shadow_draft_and_validates_without_overclaiming(self):
        package = self.package()
        result = validate_runtime_package(package)
        self.assertTrue(result["valid"])
        self.assertFalse(package["release"]["student_visible"])
        self.assertTrue(result["claims_are_not_independently_verified"])

    def test_publish_requires_human_approval(self):
        package = self.package()
        package["release"].update({"status": "published", "student_visible": True})
        self.assertIn("published_requires_human_approval", validate_runtime_package(package)["errors"])
        package["release"]["approval"] = {"actor_id": "instructor-1", "approved_at": "2026-08-02T00:00:00Z"}
        self.assertTrue(validate_runtime_package(package)["valid"])

    def test_agent_decision_ledger_captures_modify_and_evidence(self):
        event = record_agent_decision(
            course_id="ail-606",
            actor_id="instructor-1",
            actor_role="instructor",
            decision="modify",
            proposal_id="proposal-1",
            original={"prompt": "Explain evidence"},
            revised={"prompt": "Compare the claim with one source"},
            rationale="Make the evidence action observable.",
            evidence_ids=["src-1"],
        )
        self.assertEqual(event["decision"], "modify")
        self.assertEqual(event["evidence_ids"], ["src-1"])
        self.assertTrue(event["event_hash"])

    def test_social_metrics_do_not_treat_clicks_as_learning(self):
        result = summarize_social_outcomes([
            {"event_type": "peer_pulse_seen"},
            {"event_type": "social_round_started"},
            {"event_type": "social_evidence_compared", "evidence_submitted": True},
        ])
        self.assertEqual(result["cue_impressions"], 1)
        self.assertEqual(result["evidence_compare_completion_rate"], 1.0)
        self.assertEqual(result["learning_gain_claim"], "not_inferred_from_clicks")

    def test_interoperability_contracts_are_normalized(self):
        event = to_caliper_event(event_type="ViewedEvent", actor_id="u1", course_id="ail-606", object_id="01/01", action="Viewed")
        self.assertEqual(event["@context"], "http://purl.imsglobal.org/ctx/caliper/v1p2")
        users = normalize_oneroster_users([{"sourcedId": "u1", "role": "student", "orgs": ["org-1"]}])
        self.assertEqual(users[0]["metadata"]["privacy_scope"], "course_only")
        competency = build_case_competency(uri="urn:case:1", statement="Use evidence", human_code="EVD-1", document_uri="urn:case:doc")
        self.assertEqual(competency["type"], "CFItem")
        lti = build_lti13_context(
            issuer="https://lms.example.edu",
            client_id="client-1",
            deployment_id="deploy-1",
            context_id="ctx-1",
            course_id="ail-606",
            resource_link_id="reader-1",
            roles=["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
        )
        self.assertTrue(lti["jwt_validation_required"])
        self.assertEqual(lti["privacy_scope"], "course_only")

    def test_model_registry_requires_approval_for_production(self):
        registry = ModelRegistry()
        with self.assertRaisesRegex(ValueError, "approval"):
            registry.register(provider="openai", model_id="gpt", version="1", capabilities=["tutor"], status="production")
        record = registry.register(provider="openai", model_id="gpt", version="1", capabilities=["tutor"], approved_by="admin-1", status="production")
        self.assertEqual(record["status"], "production")
        self.assertEqual(registry.retire(record["id"], "admin-1")["status"], "retired")

    def test_privacy_export_and_confirmed_deletion(self):
        records = [{"id": "a", "user_id": "u1", "value": "kept for export"}, {"id": "b", "user_id": "u2"}]
        export = build_privacy_export(subject_id="u1", records=records)
        self.assertEqual([row["id"] for row in export["records"]], ["a"])
        plan = build_privacy_deletion_plan(subject_id="u1", records=records)
        self.assertTrue(plan["requires_explicit_confirmation"])
        deleted = apply_privacy_deletion(subject_id="u1", records=records)
        self.assertEqual(deleted["removed_ids"], ["a"])

    def test_incident_response_is_ordered_and_auditable(self):
        incident = create_incident(course_id="ail-606", severity="high", category="unsafe_output", summary="Unsupported claim", detected_by="admin-1")
        incident = transition_incident(incident, target_status="triaged", actor_id="admin-1")
        incident = transition_incident(incident, target_status="contained", actor_id="admin-1", note="Paused adaptive interventions")
        self.assertEqual(incident["status"], "contained")
        self.assertEqual(len(incident["timeline"]), 3)

    def test_evaluation_manifest_is_noncausal_until_preregistered(self):
        manifest = build_evaluation_manifest(course_id="ail-606", intervention="evidence trail", comparison="reader only", primary_outcome="transfer", secondary_outcomes=["calibration"])
        self.assertFalse(manifest["preregistered"])
        self.assertEqual(manifest["causal_claim_status"], "not_established")


if __name__ == "__main__":
    unittest.main()
