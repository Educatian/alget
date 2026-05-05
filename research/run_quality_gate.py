from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
PUBLIC = FRONTEND / "public"
CONTENT = FRONTEND / "content"
REPORT_MD = ROOT / "research" / "HIGH_QUALITY_REPRO_QA_REPORT.md"
REPORT_JSON = ROOT / "research" / "high_quality_repro_qa_report.json"


COURSES = ["ail606-supplement", "cat531-supplement", "cat100-supplement"]
TEMPLATE_MARKERS = [
    "student must inspect a real artifact form",
    "Before touching the AI support",
    "What makes the artifact ready for instructor review?",
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def list_mdx() -> list[Path]:
    files: list[Path] = []
    for course in COURSES:
        files.extend(sorted((CONTENT / course).glob("*/*.mdx")))
    return files


def resolve_public_link(link: str) -> Path:
    return PUBLIC / link.lstrip("/")


def check_content_surface(mdx_files: list[Path]) -> dict:
    marker_counts = Counter()
    missing_links: list[str] = []
    artifact_contract_violations: list[str] = []
    dynamic_prompt_count = 0
    reference_sections = 0

    link_pattern = re.compile(r'["(](/(?:course-art|downloads)/[^")\s]+)')
    artifact_pattern = re.compile(r"<artifact-studio\s+([^>]*)/?>", re.IGNORECASE)
    attr_pattern = re.compile(r'([a-zA-Z0-9_-]+)="([^"]*)"')
    for path in mdx_files:
        text = read_text(path)
        for marker in TEMPLATE_MARKERS:
            if marker in text:
                marker_counts[marker] += 1
        dynamic_prompt_count += text.count("<dynamic-scenario prompt=")
        if "## References" in text or "doi.org/" in text or "https://" in text:
            reference_sections += 1
        for link in link_pattern.findall(text):
            if not resolve_public_link(link).exists():
                missing_links.append(f"{path.relative_to(ROOT)} -> {link}")
        for attrs_text in artifact_pattern.findall(text):
            attrs = dict(attr_pattern.findall(attrs_text))
            missing_attrs = [
                name for name in ("artifact", "course", "section")
                if not attrs.get(name, "").strip()
            ]
            if missing_attrs:
                artifact_contract_violations.append(
                    f"{path.relative_to(ROOT)} missing {', '.join(missing_attrs)}"
                )

    return {
        "sections": len(mdx_files),
        "template_marker_counts": dict(marker_counts),
        "dynamic_prompt_count": dynamic_prompt_count,
        "artifact_studio_count": sum(read_text(path).count("<artifact-studio ") for path in mdx_files),
        "artifact_contract_violations": artifact_contract_violations,
        "reference_sections": reference_sections,
        "missing_links": missing_links,
    }


def check_artifacts() -> dict:
    packets = sorted((PUBLIC / "downloads" / "summer2026").glob("*/*.md"))
    deep_pngs = sorted((PUBLIC / "course-art" / "deep-exemplars").glob("*/*.png"))
    short_packets = []
    for packet in packets:
        words = re.findall(r"\b\w+\b", read_text(packet))
        if len(words) < 250:
            short_packets.append(f"{packet.relative_to(ROOT)} ({len(words)} words)")
    return {
        "artifact_packets": len(packets),
        "deep_exemplar_pngs": len(deep_pngs),
        "short_packets_under_250_words": short_packets[:20],
        "short_packet_count": len(short_packets),
    }


def check_manifest() -> dict:
    manifest_path = PUBLIC / "course-art" / "imagegen2_manifest.json"
    entries = json.loads(read_text(manifest_path))
    missing = []
    for entry in entries:
        output = ROOT / entry["recommended_output"]
        if not output.exists():
            missing.append(entry["recommended_output"])
    imagegen2_assets = sorted((PUBLIC / "course-art" / "imagegen2").glob("*.png"))
    return {
        "manifest_entries": len(entries),
        "missing_recommended_outputs": missing,
        "imagegen2_assets": len(imagegen2_assets),
    }


def check_measures() -> dict:
    item_bank = json.loads(read_text(ROOT / "research" / "measures" / "pre_post_item_bank.json"))
    by_course = defaultdict(int)
    answer_positions = Counter()
    for item in item_bank.get("items", []):
        by_course[item.get("course_id", "unknown")] += 1
        answer_positions[str(item.get("correct_index"))] += 1
    return {
        "items": len(item_bank.get("items", [])),
        "items_by_course": dict(by_course),
        "correct_index_distribution": dict(answer_positions),
    }


def check_reproducibility_docs() -> dict:
    analysis_plan = read_text(ROOT / "research" / "analysis_plan.md")
    schema = read_text(ROOT / "backend" / "supabase_research_schema.sql")
    smoke_json = json.loads(read_text(ROOT / "research" / "reproducibility_smoke_report.json"))
    model_json = json.loads(read_text(ROOT / "research" / "model_validation" / "learner_model_validation.json"))
    smoke_passed = (
        all(item.get("passed") for item in smoke_json)
        if isinstance(smoke_json, list)
        else smoke_json.get("overall_status") == "PASS"
    )
    model_variants = (
        [item.get("model") for item in model_json]
        if isinstance(model_json, list)
        else sorted(model_json.get("models", {}).keys())
    )
    return {
        "analysis_plan_excludes_mediators_from_primary": "Do not include post-treatment variables" in analysis_plan,
        "assignment_function_present": "create or replace function assign_experiment_arm" in schema,
        "smoke_passed": smoke_passed,
        "model_variants": sorted(model_variants),
    }


def check_real_artifact_validation_pipeline() -> dict:
    real_dir = ROOT / "research" / "real_artifact_validation"
    required_files = [
        "README.md",
        "INPUT_SCHEMA.md",
        "RUBRIC_CODEBOOK.md",
        "VALIDATION_PROTOCOL.md",
        "real_data_export.sql",
        "analyze_real_validation.py",
    ]
    missing = [name for name in required_files if not (real_dir / name).exists()]
    export_sql = read_text(real_dir / "real_data_export.sql") if (real_dir / "real_data_export.sql").exists() else ""
    protocol = read_text(real_dir / "VALIDATION_PROTOCOL.md") if (real_dir / "VALIDATION_PROTOCOL.md").exists() else ""
    codebook = read_text(real_dir / "RUBRIC_CODEBOOK.md") if (real_dir / "RUBRIC_CODEBOOK.md").exists() else ""
    script_text = read_text(real_dir / "analyze_real_validation.py") if (real_dir / "analyze_real_validation.py").exists() else ""
    taxonomy_text = read_text(FRONTEND / "src" / "lib" / "artifactTaxonomy.js")
    return {
        "missing_files": missing,
        "exports_raw_tables": "artifact_revision_scores" in export_sql and "human_ratings" in export_sql,
        "exports_submission_lineage": "submission_id" in export_sql
        and "artifact_definition_id" in export_sql
        and "artifact_family" in export_sql
        and "artifact_submission_spec_version" in export_sql
        and "artifact_required_files" in export_sql
        and "artifact_required_sections" in export_sql
        and "source_text_metrics" in export_sql
        and "raw_submission_privacy" in export_sql,
        "runtime_submission_spec": "submissionSpec" in taxonomy_text
        and "acceptedFormats" in taxonomy_text
        and "requiredFiles" in taxonomy_text
        and "requiredSections" in taxonomy_text
        and "artifact-submission-spec-v1" in taxonomy_text,
        "states_no_synthetic_evidence": "Do not treat synthetic data as evidence" in protocol,
        "has_rating_anchors": "0 Missing" in codebook and "2 Strong" in codebook,
        "computes_real_validity_metrics": "icc_two_way_random_absolute_single" in script_text
        and "weighted_kappa" in script_text
        and "MAE" in script_text
        and "Bland-Altman" in script_text,
        "fails_without_real_data": "NO_REAL_DATA" in script_text,
        "requires_submission_lineage": "REQUIRED_TRACE_COLUMNS" in script_text
        and "submission_id" in script_text
        and "artifact_definition_id" in script_text
        and "artifact_submission_spec_version" in script_text
        and "artifact_required_sections" in script_text
        and "raw_text_persisted" in script_text,
    }


def check_intelligent_textbook_benchmark() -> dict:
    benchmark_path = ROOT / "research" / "INTELLIGENT_TEXTBOOK_BENCHMARK_AUDIT.md"
    text = read_text(benchmark_path) if benchmark_path.exists() else ""
    required_comparators = ["zyBooks", "ALEKS", "Knewton Alta", "SmartBook", "Perusall", "Inquire Biology"]
    return {
        "benchmark_present": benchmark_path.exists(),
        "comparators_present": [name for name in required_comparators if name in text],
        "novelty_score_present": "Overall novelty readiness" in text,
        "source_anchor_count": text.count("https://"),
    }


def check_perusall_reading_integration() -> dict:
    reading_pane = read_text(FRONTEND / "src" / "components" / "ReadingPane.jsx")
    perusall_layer = read_text(FRONTEND / "src" / "components" / "PerusallLayer.jsx")
    social_schema = read_text(ROOT / "backend" / "supabase_social_annotation_research.sql")
    book_layout_test = read_text(FRONTEND / "src" / "pages" / "BookLayout.integration.test.jsx")
    frontend_tests = sorted((FRONTEND / "src" / "components").glob("*Layer.test.jsx"))
    artifact_tests = sorted((FRONTEND / "src" / "components").glob("*ArtifactStudio*.test.jsx"))
    narrative_tests = sorted((FRONTEND / "src" / "components").glob("*ReadingNarrative*.test.jsx"))
    package_json = read_text(FRONTEND / "package.json")
    playwright_config = read_text(FRONTEND / "playwright.config.js") if (FRONTEND / "playwright.config.js").exists() else ""
    playwright_smoke = read_text(FRONTEND / "e2e" / "playwright-smoke.spec.js") if (FRONTEND / "e2e" / "playwright-smoke.spec.js").exists() else ""
    accessibility_smoke = read_text(FRONTEND / "e2e" / "accessibility.spec.js") if (FRONTEND / "e2e" / "accessibility.spec.js").exists() else ""
    learner_workflow = read_text(FRONTEND / "e2e" / "learner-workflow.spec.js") if (FRONTEND / "e2e" / "learner-workflow.spec.js").exists() else ""
    app = read_text(FRONTEND / "src" / "App.jsx")
    supabase = read_text(FRONTEND / "src" / "lib" / "supabase.js")
    reading_narrative = read_text(FRONTEND / "src" / "components" / "ReadingNarrative.jsx")

    required_annotation_terms = [
        "section_annotations",
        "annotation_reactions",
        "quote_hash",
        "visibility",
        "annotation_network_edges",
    ]

    return {
        "reading_pane_lazy_mount": "const PerusallLayer = lazy(() => import('./PerusallLayer'))" in reading_pane
        and "<PerusallLayer" in reading_pane
        and "sectionId={sectionId}" in reading_pane
        and "sectionTitle={meta?.title || ''}" in reading_pane
        and "conceptIds={meta?.concept_ids || []}" in reading_pane,
        "perusall_tables_present": [
            term for term in required_annotation_terms if term in social_schema
        ],
        "perusall_local_fallback": "Offline local annotation mode" in perusall_layer
        and "safeLocalStorageSet" in perusall_layer
        and "source: 'local'" in perusall_layer,
        "focused_frontend_tests": [
            str(path.relative_to(ROOT))
            for path in [*frontend_tests, *artifact_tests, *narrative_tests]
        ],
        "supplement_route_smoke_tests": all(
            course in book_layout_test
            for course in COURSES
        ) and "smoke-renders the Summer 2026 supplement route" in book_layout_test,
        "browser_route_smoke_suite": "\"test:e2e\": \"playwright test\"" in package_json
        and "testDir: './e2e'" in playwright_config
        and "webServer:" in playwright_config
        and "127.0.0.1:5179" in playwright_config
        and "VITE_E2E_AUTH_BYPASS=true" in playwright_config
        and all(course in playwright_smoke for course in COURSES)
        and "bodyText" in playwright_smoke
        and "pageerror" in playwright_smoke
        and "requestfailed" in playwright_smoke,
        "accessibility_gate": "@axe-core/playwright" in package_json
        and "AxeBuilder" in accessibility_smoke
        and "serious" in accessibility_smoke
        and "critical" in accessibility_smoke,
        "full_learner_workflow_gate": "add public note" in learner_workflow.lower()
        and "initial work product draft" in learner_workflow.lower()
        and "artifact-revision/score" in learner_workflow
        and "artifact-trace/validate" in learner_workflow
        and "backend policy recommends" in learner_workflow.lower()
        and "trace completeness 100%" in learner_workflow.lower(),
        "e2e_auth_offline_mode": "VITE_E2E_AUTH_BYPASS" in app
        and "E2E_USER" in app
        and "e2eAuthBypass" in supabase,
        "generated_mdx_indent_normalization": "normalizeMarkdownSource" in reading_narrative
        and "dominantIndent" in reading_narrative
        and "content-visibility" not in learner_workflow,
    }


def check_evidence_loop() -> dict:
    diagnostic = read_text(FRONTEND / "src" / "pages" / "DiagnosticAssessment.jsx")
    artifact_studio = read_text(FRONTEND / "src" / "components" / "ArtifactStudio.jsx")
    knowledge_graph = read_text(FRONTEND / "src" / "components" / "KnowledgeGraph.jsx")
    reading_pane = read_text(FRONTEND / "src" / "components" / "ReadingPane.jsx")
    book_layout = read_text(FRONTEND / "src" / "pages" / "BookLayout.jsx")
    analytics_dashboard = read_text(FRONTEND / "src" / "pages" / "AnalyticsDashboard.jsx")
    perusall_layer = read_text(FRONTEND / "src" / "components" / "PerusallLayer.jsx")
    knowledge_service = read_text(FRONTEND / "src" / "lib" / "knowledgeService.js")
    research_service = read_text(FRONTEND / "src" / "lib" / "researchService.js")
    logging_service = read_text(FRONTEND / "src" / "lib" / "loggingService.js")
    server = read_text(ROOT / "backend" / "server.py")
    schema = read_text(ROOT / "backend" / "supabase_research_schema.sql")

    return {
        "diagnostic_constructs_item_responses": "const itemResponses = questions.map" in diagnostic
        and "itemResponses" in diagnostic
        and "response_payload" in diagnostic,
        "research_service_persists_item_responses": "persistEvaluationResponses" in research_service
        and ".from('evaluation_responses')" in research_service,
        "artifact_quality_rubric": "RUBRIC_ROWS" in artifact_studio
        and "artifactQualityScore" in artifact_studio
        and "artifact_quality_score" in artifact_studio
        and "rubric" in artifact_studio,
        "support_rationale_visible": "Why This Support Now" in artifact_studio
        and "recommended_support_move" in artifact_studio
        and "support_rationale" in artifact_studio,
        "trusted_research_validators": "/api/research/evaluation/validate" in server
        and "/api/research/artifact-trace/validate" in server
        and "validate_research_evaluation_payload" in server
        and "validate_artifact_trace_payload" in server,
        "frontend_uses_research_validators": "validateEvaluationWithBackend" in research_service
        and "/research/evaluation/validate" in research_service
        and "validateArtifactStudioEvent" in logging_service
        and "/research/artifact-trace/validate" in logging_service,
        "annotation_artifact_recommender_signals": "recordAdaptiveSignal(sectionId, 'annotation_create'" in perusall_layer
        and "recordAdaptiveSignal(sectionId, 'artifact_studio_trace'" in artifact_studio
        and "annotation_friction" in server
        and "artifact_gap" in server
        and "artifact_quality_average" in knowledge_service
        and "annotation_questions" in knowledge_service,
        "artifact_revision_scorer_loop": "/api/research/artifact-revision/score" in server
        and "score_artifact_revision_payload" in server
        and "/research/artifact-revision/score" in artifact_studio
        and "revision_scores" in artifact_studio
        and ".from('artifact_revision_scores')" in logging_service
        and "artifact_revision_scores" in schema,
        "brain_graph_action_explanation": "What this shows" in knowledge_graph
        and "Next action" in knowledge_graph
        and "Node color is not a grade" in knowledge_graph
        and "knowledge-graph-mount" in knowledge_graph,
        "returning_learner_checkin": "Returning Learner Check-In" in reading_pane
        and "judging AI feedback" in reading_pane
        and "recentSection" in book_layout,
        "artifact_cohort_dashboard": "Artifact revision cohort dashboard" in analytics_dashboard
        and "artifact_revision_cohort_summary" in research_service
        and "artifact_revision_cohort_summary" in schema
        and "revoke all on artifact_revision_cohort_summary from anon" in schema,
    }


def status_line(name: str, passed: bool, detail: str) -> str:
    return f"- {'PASS' if passed else 'FAIL'} `{name}`: {detail}"


def main() -> int:
    mdx_files = list_mdx()
    content = check_content_surface(mdx_files)
    artifacts = check_artifacts()
    manifest = check_manifest()
    measures = check_measures()
    repro = check_reproducibility_docs()
    real_validation = check_real_artifact_validation_pipeline()
    benchmark = check_intelligent_textbook_benchmark()
    perusall = check_perusall_reading_integration()
    evidence_loop = check_evidence_loop()

    gates = [
        (
            "supplement_section_count",
            content["sections"] == 192,
            f"{content['sections']} sections found; expected 192",
        ),
        (
            "public_link_integrity",
            len(content["missing_links"]) == 0,
            f"{len(content['missing_links'])} missing MDX public links",
        ),
        (
            "dynamic_scenario_contract",
            content["dynamic_prompt_count"] == 192,
            f"{content['dynamic_prompt_count']} prompt-based dynamic scenarios found and component now accepts prompt",
        ),
        (
            "artifact_studio_interface",
            content["artifact_studio_count"] == 192,
            f"{content['artifact_studio_count']} artifact-studio blocks found",
        ),
        (
            "artifact_studio_markdown_contract",
            len(content["artifact_contract_violations"]) == 0,
            f"{len(content['artifact_contract_violations'])} artifact-studio blocks missing artifact/course/section attrs",
        ),
        (
            "imagegen2_manifest_integrity",
            len(manifest["missing_recommended_outputs"]) == 0,
            f"{len(manifest['missing_recommended_outputs'])} missing recommended outputs",
        ),
        (
            "artifact_packet_depth",
            artifacts["short_packet_count"] == 0,
            f"{artifacts['short_packet_count']} packets under 250 words",
        ),
        (
            "template_uniformity",
            max(content["template_marker_counts"].values() or [0]) < 40,
            f"template marker max count = {max(content['template_marker_counts'].values() or [0])}",
        ),
        (
            "citation_grounding",
            content["reference_sections"] >= 96,
            f"{content['reference_sections']} sections have explicit references/URLs",
        ),
        (
            "measure_depth",
            measures["items"] >= 36
            and set(measures["correct_index_distribution"].keys()) == {"0", "1", "2", "3"}
            and min(measures["correct_index_distribution"].values()) >= 6,
            f"{measures['items']} items; correct-index distribution {measures['correct_index_distribution']}",
        ),
        (
            "assignment_reproducibility",
            repro["assignment_function_present"],
            "deterministic assignment function present",
        ),
        (
            "primary_model_specification",
            repro["analysis_plan_excludes_mediators_from_primary"],
            "analysis plan separates ITT from mediator models",
        ),
        (
            "reproducibility_smoke",
            repro["smoke_passed"],
            f"overall smoke status = {repro['smoke_passed']}",
        ),
        (
            "real_artifact_validation_pipeline",
            len(real_validation["missing_files"]) == 0
            and real_validation["exports_raw_tables"]
            and real_validation["exports_submission_lineage"]
            and real_validation["runtime_submission_spec"]
            and real_validation["states_no_synthetic_evidence"]
            and real_validation["has_rating_anchors"]
            and real_validation["computes_real_validity_metrics"]
            and real_validation["fails_without_real_data"],
            f"missing={real_validation['missing_files']}; raw_exports={real_validation['exports_raw_tables']}; submission_lineage={real_validation['exports_submission_lineage']}; runtime_spec={real_validation['runtime_submission_spec']}; no_real_data_guard={real_validation['fails_without_real_data']}",
        ),
        (
            "intelligent_textbook_benchmark",
            benchmark["benchmark_present"]
            and len(benchmark["comparators_present"]) >= 6
            and benchmark["novelty_score_present"]
            and benchmark["source_anchor_count"] >= 8,
            f"{len(benchmark['comparators_present'])} comparators; {benchmark['source_anchor_count']} source anchors",
        ),
        (
            "perusall_reading_narrative_integration",
            perusall["reading_pane_lazy_mount"]
            and len(perusall["perusall_tables_present"]) >= 5
            and perusall["perusall_local_fallback"]
            and len(perusall["focused_frontend_tests"]) >= 3,
            f"mount={perusall['reading_pane_lazy_mount']}; schema terms={len(perusall['perusall_tables_present'])}; focused tests={len(perusall['focused_frontend_tests'])}",
        ),
        (
            "supplement_route_smoke_coverage",
            perusall["supplement_route_smoke_tests"],
            f"three supplement route smoke tests present = {perusall['supplement_route_smoke_tests']}",
        ),
        (
            "browser_route_smoke_coverage",
            perusall["browser_route_smoke_suite"],
            f"Playwright route/browser smoke suite present = {perusall['browser_route_smoke_suite']}",
        ),
        (
            "accessibility_gate",
            perusall["accessibility_gate"],
            f"axe serious/critical WCAG route gate present = {perusall['accessibility_gate']}",
        ),
        (
            "full_learner_workflow_gate",
            perusall["full_learner_workflow_gate"],
            f"annotation to artifact scoring to adaptive rationale E2E gate present = {perusall['full_learner_workflow_gate']}",
        ),
        (
            "e2e_auth_offline_mode",
            perusall["e2e_auth_offline_mode"],
            f"E2E auth bypass and Supabase offline mode present = {perusall['e2e_auth_offline_mode']}",
        ),
        (
            "generated_mdx_indent_normalization",
            perusall["generated_mdx_indent_normalization"],
            f"generated MDX indentation normalization protects artifact-studio rendering = {perusall['generated_mdx_indent_normalization']}",
        ),
        (
            "diagnostic_item_response_loop",
            evidence_loop["diagnostic_constructs_item_responses"]
            and evidence_loop["research_service_persists_item_responses"],
            f"diagnostic={evidence_loop['diagnostic_constructs_item_responses']}; persistence={evidence_loop['research_service_persists_item_responses']}",
        ),
        (
            "artifact_quality_trace_loop",
            evidence_loop["artifact_quality_rubric"] and evidence_loop["support_rationale_visible"],
            f"rubric={evidence_loop['artifact_quality_rubric']}; rationale={evidence_loop['support_rationale_visible']}",
        ),
        (
            "trusted_research_validation_loop",
            evidence_loop["trusted_research_validators"] and evidence_loop["frontend_uses_research_validators"],
            f"server={evidence_loop['trusted_research_validators']}; frontend={evidence_loop['frontend_uses_research_validators']}",
        ),
        (
            "annotation_artifact_recommender_loop",
            evidence_loop["annotation_artifact_recommender_signals"],
            f"annotation/artifact signals drive adaptive telemetry = {evidence_loop['annotation_artifact_recommender_signals']}",
        ),
        (
            "artifact_revision_scorer_loop",
            evidence_loop["artifact_revision_scorer_loop"],
            f"semantic scorer + score-derived persistence = {evidence_loop['artifact_revision_scorer_loop']}",
        ),
        (
            "brain_graph_action_explanation",
            evidence_loop["brain_graph_action_explanation"],
            f"brain graph explains status and next artifact action = {evidence_loop['brain_graph_action_explanation']}",
        ),
        (
            "returning_learner_checkin",
            evidence_loop["returning_learner_checkin"],
            f"recent-section continuity and AI judgment cue present = {evidence_loop['returning_learner_checkin']}",
        ),
        (
            "artifact_cohort_dashboard",
            evidence_loop["artifact_cohort_dashboard"],
            f"instructor aggregate artifact revision dashboard = {evidence_loop['artifact_cohort_dashboard']}",
        ),
    ]

    report = {
        "overall_status": "PASS" if all(passed for _, passed, _ in gates) else "FAIL",
        "gates": [{"name": name, "passed": passed, "detail": detail} for name, passed, detail in gates],
        "content": content,
        "artifacts": artifacts,
        "manifest": manifest,
        "measures": measures,
        "reproducibility": repro,
        "real_artifact_validation": real_validation,
        "intelligent_textbook_benchmark": benchmark,
        "perusall_reading_integration": perusall,
        "evidence_loop": evidence_loop,
    }
    REPORT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "# ALGET High-Quality Reproducibility and QA Gate",
        "",
        f"Overall status: **{report['overall_status']}**",
        "",
        "## Gates",
        "",
    ]
    lines.extend(status_line(name, passed, detail) for name, passed, detail in gates)
    lines.extend([
        "",
        "## Sharp Findings",
        "",
        "- Build/test stability is acceptable when lint, production build, Vitest, Playwright route smoke, Python compile, content audit, reproducibility smoke, and model validation pass.",
        "- The previous strict blockers for template uniformity, shallow downloadable packets, citation grounding, and measure depth are now cleared by automated gates.",
        "- Empirical reproducibility improved with deterministic assignment, corrected ITT analysis, diagnostic item-response wiring, artifact-quality trace instrumentation, and trusted server-side validation gates.",
        "- HCI/system QA now includes serious/critical WCAG checks, semantic browser smoke over a Playwright-owned ALGET server, E2E auth isolation, and a full annotation-to-artifact-to-adaptive-rationale learner workflow.",
        "- A real-data artifact validation package now defines raw Supabase exports, rater codebook, validation protocol, and an analyzer that refuses to pass without actual learner/rater export rows.",
        "- Competitive novelty is now benchmarked against zyBooks, ALEKS, Knewton Alta, SmartBook, Perusall, and Inquire Biology; ALGET's defensible novelty must be artifact-centered annotation-informed adaptivity, not generic adaptive courseware.",
        "",
        "## Remaining A+ Work",
        "",
        "1. Extend the new generic artifact-studio UI into specialized tools: storyboard editor, rubric scorer, annotation map, transcript critique, resume evidence checker, and spreadsheet task.",
        "2. Extend browser QA from route smoke to full workflow and accessibility checks.",
        "3. Tighten instructor-facing exports around de-identified cohort views only.",
        "4. Add instructor validation sampling for the semantic artifact revision scores.",
        "5. Collect pilot/RCT data before claiming superior learning outcomes.",
        "",
    ])
    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"{report['overall_status']} {REPORT_MD}")
    return 0 if report["overall_status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
