// ---------------------------------------------------------------------------
// Cloudflare Worker: alget-adaptive-recommendation
//
// Low-latency edge port of the FastAPI /adaptive_recommendation pure path. It
// accepts the SAME request contract the client already sends (mirroring the
// Supabase edge fn's index.ts feature assembly), runs the PARITY-VERIFIED pure
// policy (./policy.ts, a verbatim copy of the Supabase policy.ts which is a 1:1
// mirror of backend/knowledge_tracing.py), generates a decision_id, enforces the
// faithfulness invariant, and returns { decision_id, ... } in the same shape as
// the Supabase edge fn / FastAPI.
//
// LATENCY DESIGN: the response is pure policy compute + return. There are NO
// per-request DB reads. The ONLY Worker->Supabase interaction is a BEST-EFFORT,
// fire-and-forget provenance WRITE dispatched via ctx.waitUntil(...) so it never
// blocks the response. A failed/absent write never affects the caller.
//
// v1 scope: features are assembled from the request payload exactly as the
// FastAPI path consumes them post-feature-gather. DB-side feature mining
// (mastery reads, telemetry aggregation, artifact/annotation scoring) is
// deferred to v2 (see research/CLOUD_ADAPTIVITY_REVAMP.md). The client already
// sends the assembled signals, so v1 trusts that payload.
//
// Env (set via `wrangler secret put`): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ---------------------------------------------------------------------------

import {
  reason_codes_are_faithful,
  select_support_move,
  type FeatureVector,
} from "./policy.ts";

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface AdaptiveRequest {
  learner_id?: string | null;
  course?: string | null;
  section_id?: string | null;
  session_id?: string | null;
  annotation_adaptive?: boolean;
  // Pre-assembled feature vector (preferred): the exact normalized features the
  // pure policy consumes. The FastAPI path builds this server-side; the client
  // may send it directly for the edge path.
  features?: FeatureVector;
  // Raw signal families the client already sends; folded into features when a
  // pre-assembled `features` object is not provided.
  artifact_revision_scores?: unknown[];
  annotation_signals?: unknown[];
  learner_profile?: Record<string, unknown>;
  // Optional readiness gate hint mirroring the FastAPI prefer_advance path.
  readiness?: string;
  prefer_advance?: boolean;
  // Optional content-version provenance (FastAPI stamps this server-side).
  content_version?: string | null;
  content_version_algorithm?: string | null;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function corsHeaders(request: Request): Record<string, string> {
  // Echo the Origin when present so credentialed callers work, but default to
  // "*" for the public, unauthenticated policy endpoint.
  const origin = request.headers.get("Origin");
  return origin
    ? { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin }
    : { ...CORS_HEADERS };
}

function jsonResponse(
  body: unknown,
  request: Request,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "boolean" ? (value ? 1 : 0) : Number(value);
  return Number.isNaN(n) ? fallback : n;
}

// Round to 4 decimals to match the FastAPI feature_vector rounding so the
// edge-assembled vector is byte-identical to the served path.
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// v1 feature assembly. If the client sends a pre-assembled `features` object we
// use it verbatim (this is the post-feature-gather vector the FastAPI policy
// consumes). Otherwise we derive a minimal vector from the learner_profile /
// raw signal families the client already transmits, mirroring the FastAPI keys.
// (Identical to the Supabase edge fn's assembleFeatures so both paths agree.)
function assembleFeatures(req: AdaptiveRequest): FeatureVector {
  if (req.features && typeof req.features === "object") {
    return { ...req.features };
  }

  const profile = (req.learner_profile ?? {}) as Record<string, unknown>;
  const artifactScores = Array.isArray(req.artifact_revision_scores)
    ? req.artifact_revision_scores
    : [];
  const annotationSignals = Array.isArray(req.annotation_signals)
    ? req.annotation_signals
    : [];

  // Artifact-revision family: mean quality and mean before/after delta.
  let artifactQuality = num(profile["artifact_quality"]);
  let artifactGap = num(profile["artifact_gap"]);
  let artifactDelta = num(profile["artifact_revision_delta"]);
  if (artifactScores.length > 0) {
    let qSum = 0;
    let dSum = 0;
    for (const s of artifactScores) {
      const o = s as Record<string, unknown>;
      const q = num(o?.quality ?? o?.after ?? o?.score);
      qSum += q;
      dSum += num(o?.delta ?? 0);
    }
    artifactQuality = qSum / artifactScores.length;
    artifactDelta = dSum / artifactScores.length;
    artifactGap = Math.max(0, Math.min(1, 1 - artifactQuality));
  }

  // Annotation family: friction ratio, momentum, section overlap.
  let annotationFriction = num(profile["annotation_friction"]);
  let annotationMomentum = num(profile["annotation_momentum"]);
  let annotationOverlap = num(profile["annotation_section_overlap"]);
  if (annotationSignals.length > 0) {
    let frictionCount = 0;
    let overlapCount = 0;
    for (const a of annotationSignals) {
      const o = a as Record<string, unknown>;
      const type = String(o?.type ?? "").toLowerCase();
      if (type === "question" || type === "confusion" || type === "friction") {
        frictionCount += 1;
      }
      if (o?.section_overlap || o?.same_section) {
        overlapCount += 1;
      }
    }
    annotationFriction = frictionCount / annotationSignals.length;
    annotationOverlap = overlapCount / annotationSignals.length;
    annotationMomentum = Math.max(
      0,
      Math.min(1, annotationSignals.length / 5),
    );
  }

  const features: FeatureVector = {
    mastery_gap: round4(num(profile["mastery_gap"])),
    average_mastery: round4(num(profile["average_mastery"])),
    friction_signal: round4(num(profile["friction_signal"])),
    frustration_index: num(profile["frustration_index"]),
    accuracy_gap: round4(num(profile["accuracy_gap"])),
    uncertainty_signal: round4(num(profile["uncertainty_signal"])),
    correct_ratio: round4(num(profile["correct_ratio"])),
    forgetting_risk: round4(num(profile["forgetting_risk"])),
    calibration_drift: round4(num(profile["calibration_drift"])),
    transfer_readiness: round4(num(profile["transfer_readiness"])),
    stability_index: round4(num(profile["stability_index"])),
    predicted_next_correct: round4(num(profile["predicted_next_correct"])),
    predicted_retention: round4(num(profile["predicted_retention"])),
    misconception_pressure: round4(num(profile["misconception_pressure"])),
    engagement_signal: round4(num(profile["engagement_signal"])),
    support_fatigue: round4(num(profile["support_fatigue"])),
    chat_signal: round4(num(profile["chat_signal"])),
    unit_signal: num(profile["unit_signal"]),
    idle_signal: num(profile["idle_signal"]),
    no_stuck_reason: num(profile["no_stuck_reason"]),
    artifact_quality: round4(artifactQuality),
    artifact_gap: round4(artifactGap),
    artifact_revision_delta: round4(artifactDelta),
    annotation_friction: round4(annotationFriction),
    annotation_momentum: round4(annotationMomentum),
    annotation_section_overlap: round4(annotationOverlap),
  };
  return features;
}

// Best-effort persistence via PostgREST with the service role. Never throws to
// the caller: dispatched through ctx.waitUntil so it runs AFTER the response is
// sent and a failure cannot affect latency or the returned decision. If the
// secrets are unset, the write is skipped silently.
async function persistDecision(
  env: Env,
  record: Record<string, unknown>,
): Promise<void> {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return;
  }
  const decisionId = String(record.decision_id ?? crypto.randomUUID());
  const canonicalRecord = {
    id: decisionId,
    trace_id: decisionId,
    user_id: null,
    course_id: record.course ?? null,
    section_id: record.section_id ?? "unknown",
    concept_ids: [],
    chosen_action: record.selected_action,
    learner_state_snapshot: {
      learner_id: record.learner_id ?? null,
      session_id: record.session_id ?? null,
      policy_mode: record.policy_mode ?? null,
      policy_strategy: record.policy_strategy ?? null,
      annotation_adaptive: record.annotation_adaptive ?? null,
      content_version: record.content_version ?? null,
      content_version_algorithm: record.content_version_algorithm ?? null,
      source: record.source ?? "worker",
    },
    candidate_actions: record.candidate_actions ?? [],
    evidence_snapshot: record.evidence_snapshot ?? {},
    explanation_snapshot: {
      reason_codes: record.reason_codes ?? [],
      selected_action: record.selected_action ?? null,
      rejected_actions: record.rejected_actions ?? [],
      outcome: record.outcome ?? null,
      accepted: record.accepted ?? null,
    },
    policy_score: record.action_scores ?? {},
  };
  try {
    await fetch(`${url.replace(/\/+$/, "")}/rest/v1/recommendation_decisions`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(canonicalRecord),
    });
  } catch (_err) {
    // Swallow: provenance is best-effort and must never affect the response.
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, request, 405);
    }

    let req: AdaptiveRequest;
    try {
      req = (await request.json()) as AdaptiveRequest;
    } catch {
      return jsonResponse({ error: "invalid_json" }, request, 400);
    }

    const annotationAdaptive = req.annotation_adaptive !== false;
    const preferAdvance = req.prefer_advance === true ||
      req.readiness === "advance";

    const features = assembleFeatures(req);
    const decision = select_support_move(
      features,
      annotationAdaptive,
      preferAdvance,
    );

    const reasonCodes = decision.reason_codes.slice(0, 5);

    // FAITHFULNESS INVARIANT: every reason_code must map to a feature present in
    // the evidence_snapshot. Enforce BEFORE returning, exactly like the FastAPI
    // assert. We fail closed to a faithful state rather than 500 the caller.
    let faithfulCodes = reasonCodes;
    if (!reason_codes_are_faithful(faithfulCodes, decision.evidence_snapshot)) {
      faithfulCodes = faithfulCodes.filter((c) =>
        reason_codes_are_faithful([c], decision.evidence_snapshot)
      );
      if (faithfulCodes.length === 0) faithfulCodes = ["balanced_profile"];
    }

    const decisionId = crypto.randomUUID();
    const record: Record<string, unknown> = {
      decision_id: decisionId,
      created_at: Date.now() / 1000,
      section_id: req.section_id ?? null,
      content_version: req.content_version ?? null,
      content_version_algorithm: req.content_version_algorithm ?? null,
      learner_id: req.learner_id ?? null,
      session_id: req.session_id ?? null,
      course: req.course ?? null,
      policy_mode: decision.policy_mode,
      policy_strategy: "heuristic_bandit_v2",
      candidate_actions: decision.candidate_actions,
      selected_action: decision.selected_action,
      rejected_actions: decision.rejected_actions,
      action_scores: decision.action_scores,
      reason_codes: faithfulCodes,
      evidence_snapshot: decision.evidence_snapshot,
      annotation_adaptive: annotationAdaptive,
      outcome: null,
      accepted: null,
      source: "worker",
    };

    // Fire-and-forget provenance write: runs after the response is returned and
    // can NEVER block latency or surface an error to the caller.
    ctx.waitUntil(persistDecision(env, record));

    return jsonResponse({
      decision_id: decisionId,
      section_id: req.section_id ?? null,
      policy_mode: decision.policy_mode,
      selected_action: decision.selected_action,
      candidate_actions: decision.candidate_actions,
      rejected_actions: decision.rejected_actions,
      action_scores: decision.action_scores,
      reason_codes: faithfulCodes,
      evidence_snapshot: decision.evidence_snapshot,
      content_version: req.content_version ?? null,
      source: "worker",
    }, request);
  },
};

export { assembleFeatures };
