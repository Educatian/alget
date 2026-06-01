#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const DEFAULT_APP_URL = "https://alget.pages.dev";
const DEFAULT_WORKER_URL =
  "https://alget-adaptive-recommendation.jewoong-moon.workers.dev";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    const name = key.trim();
    if (!name || process.env[name]) continue;
    let value = rest.join("=").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}

function parseArgs(argv) {
  const options = {
    appUrl: process.env.ALGET_APP_URL || DEFAULT_APP_URL,
    workerUrl: process.env.ALGET_ADAPTIVE_WORKER_URL || DEFAULT_WORKER_URL,
    requireAccess: false,
    requireProvenance: false,
    checkTables: false,
    requireTables: false,
    probeOptionalWrites: false,
  };
  for (const arg of argv) {
    if (arg === "--require-access") options.requireAccess = true;
    else if (arg === "--require-provenance") options.requireProvenance = true;
    else if (arg === "--check-tables") options.checkTables = true;
    else if (arg === "--require-tables") {
      options.checkTables = true;
      options.requireTables = true;
    }
    else if (arg === "--probe-optional-writes") {
      options.checkTables = true;
      options.probeOptionalWrites = true;
    }
    else if (arg.startsWith("--app-url=")) options.appUrl = arg.slice(10);
    else if (arg.startsWith("--worker-url=")) options.workerUrl = arg.slice(13);
  }
  return options;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} did not return JSON; status=${res.status}`);
  }
  return { res, data };
}

async function smokeApp(appUrl) {
  const home = await fetch(appUrl);
  assert(home.ok, `app homepage failed: ${home.status}`);

  const tocUrl = new URL("/api/book/cat100-supplement/toc", appUrl);
  const toc = await fetchJson(tocUrl);
  assert(toc.res.ok, `TOC failed: ${toc.res.status}`);
  assert(toc.data.course === "cat100-supplement", "TOC course mismatch");
  assert(Array.isArray(toc.data.chapters), "TOC missing chapters");

  const sectionUrl = new URL("/api/book/cat100-supplement/01/01", appUrl);
  const section = await fetchJson(sectionUrl);
  assert(section.res.ok, `section failed: ${section.res.status}`);
  assert(section.data.meta?.course === "cat100-supplement", "section course mismatch");
  assert(section.data.content_version?.content_version, "section missing content_version");

  return {
    homepage: home.status,
    tocChapters: toc.data.chapters.length,
    sectionTitle: section.data.meta.title,
    contentVersion: section.data.content_version.content_version,
  };
}

async function smokeAccessGate(appUrl, requireAccess) {
  const url = new URL("/api/access/validate", appUrl);
  const response = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "education", passcode: "edu123" }),
  });

  if (response.res.status === 503) {
    if (requireAccess) {
      throw new Error("access gate is not configured in Cloudflare Pages env");
    }
    return {
      configured: false,
      valid: false,
      status: response.res.status,
      note: response.data?.error || "access_code_not_configured",
    };
  }

  assert(response.res.ok, `access gate failed: ${response.res.status}`);
  if (requireAccess) {
    assert(response.data.valid === true, "education access code did not validate");
  }
  return {
    configured: true,
    valid: Boolean(response.data.valid),
    status: response.res.status,
  };
}

function adaptiveSmokePayload(contentVersion) {
  return {
    learner_id: `codex-smoke-${Date.now()}`,
    session_id: randomUUID(),
    course: "cat100-supplement",
    section_id: "cat100-supplement/01/01",
    annotation_adaptive: true,
    content_version: contentVersion,
    content_version_algorithm: "sha256-mdx+meta+practice+misconceptions-v1",
    features: {
      mastery_gap: 0.4,
      average_mastery: 0.6,
      friction_signal: 0.7,
      frustration_index: 1,
      accuracy_gap: 0.2,
      uncertainty_signal: 0.4,
      correct_ratio: 0.5,
      forgetting_risk: 0.2,
      calibration_drift: 0.1,
      transfer_readiness: 0.2,
      stability_index: 0.5,
      predicted_next_correct: 0.5,
      predicted_retention: 0.5,
      misconception_pressure: 0.3,
      engagement_signal: 0.7,
      support_fatigue: 0.1,
      chat_signal: 0,
      unit_signal: 0,
      idle_signal: 0,
      no_stuck_reason: 0,
      artifact_quality: 0.4,
      artifact_gap: 0.6,
      artifact_revision_delta: 0.2,
      annotation_friction: 0.8,
      annotation_momentum: 0.6,
      annotation_section_overlap: 1,
    },
  };
}

async function smokeWorker(workerUrl, contentVersion) {
  const payload = adaptiveSmokePayload(contentVersion);
  const response = await fetchJson(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert(response.res.ok, `adaptive Worker failed: ${response.res.status}`);
  assert(response.data.decision_id, "adaptive Worker missing decision_id");
  assert(response.data.source === "worker", "adaptive Worker source mismatch");
  assert(response.data.content_version === contentVersion, "Worker dropped content_version");
  assert(Array.isArray(response.data.reason_codes), "Worker missing reason_codes");

  return {
    decisionId: response.data.decision_id,
    selectedAction: response.data.selected_action,
    reasonCodes: response.data.reason_codes,
  };
}

async function pollSupabaseDecision(decisionId, requireProvenance) {
  const { supabaseUrl, serviceKey } = getSupabaseServiceEnv();

  if (!supabaseUrl || !serviceKey) {
    if (requireProvenance) {
      throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    return { checked: false, found: false, note: "missing local Supabase service env" };
  }

  const base = supabaseUrl.replace(/\/+$/, "");
  const query =
    `/rest/v1/recommendation_decisions?id=eq.${encodeURIComponent(decisionId)}` +
    "&select=id,trace_id,course_id,section_id,chosen_action,learner_state_snapshot,created_at";
  let lastStatus = null;
  let lastText = "";

  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(`${base}${query}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    lastStatus = res.status;
    lastText = await res.text();
    if (res.ok) {
      const rows = lastText ? JSON.parse(lastText) : [];
      if (Array.isArray(rows) && rows.length > 0) {
        return {
          checked: true,
          found: true,
          source: rows[0].learner_state_snapshot?.source ?? null,
          sectionId: rows[0].section_id,
          chosenAction: rows[0].chosen_action,
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  if (requireProvenance) {
    throw new Error(
      `provenance row not found for ${decisionId}; lastStatus=${lastStatus}; lastBody=${lastText.slice(0, 160)}`,
    );
  }
  return { checked: true, found: false, lastStatus };
}

function getSupabaseServiceEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

async function supabaseRest(pathname, { method = "GET", body, prefer } = {}) {
  const { supabaseUrl, serviceKey } = getSupabaseServiceEnv();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}${pathname}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { res, data, text };
}

async function checkSupabaseTables(requireTables = false) {
  const { supabaseUrl, serviceKey } = getSupabaseServiceEnv();

  if (!supabaseUrl || !serviceKey) {
    if (requireTables) {
      throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    return { checked: false, note: "missing local Supabase service env" };
  }

  const base = supabaseUrl.replace(/\/+$/, "");
  const tables = [
    "event_logs",
    "interaction_events",
    "recommendation_decisions",
    "section_annotations",
    "annotation_replies",
    "annotation_reactions",
    "annotation_read_states",
    "highlight_reactions",
    "highlight_replies",
    "artifact_revision_scores",
    "human_ratings",
  ];
  const statuses = {};
  for (const table of tables) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    statuses[table] = res.status;
  }
  const missing = Object.entries(statuses)
    .filter(([, status]) => status === 404)
    .map(([table]) => table);
  const failing = Object.entries(statuses)
    .filter(([, status]) => status >= 400)
    .map(([table, status]) => `${table}:${status}`);
  if (requireTables && failing.length > 0) {
    throw new Error(`Supabase table check failed: ${failing.join(", ")}`);
  }
  return { checked: true, statuses, missing };
}

async function findExistingUserId() {
  for (const table of ["event_logs", "interaction_events"]) {
    const { res, data } = await supabaseRest(
      `/rest/v1/${table}?select=user_id&user_id=not.is.null&limit=1`,
    );
    if (res.ok && Array.isArray(data) && data[0]?.user_id) return data[0].user_id;
  }
  return null;
}

async function findExistingHighlightId() {
  const { res, data } = await supabaseRest(
    "/rest/v1/highlights?select=id&limit=1",
  );
  if (res.ok && Array.isArray(data) && data[0]?.id) return data[0].id;
  return null;
}

async function probeOptionalWrites() {
  const marker = `codex-smoke-${Date.now()}`;
  const created = {
    annotationId: null,
    replyId: null,
    artifactScoreId: null,
    reaction: false,
    readState: false,
  };
  const result = {
    checked: true,
    annotationInsert: false,
    replyInsert: false,
    reactionInsert: "skipped",
    readStateInsert: "skipped",
    highlightReactionInsert: "skipped",
    highlightReplyInsert: "skipped",
    artifactScoreInsert: false,
    cleanup: false,
  };

  try {
    const userId = await findExistingUserId();
    const annotation = await supabaseRest(
      "/rest/v1/section_annotations?select=id",
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          section_id: "cat100-supplement/01/01",
          course_id: "cat100-supplement",
          concept_ids: ["codex_smoke"],
          quote_text: marker,
          quote_hash: marker,
          annotation_type: "question",
          body: "Codex smoke annotation write probe.",
          visibility: "private",
        },
      },
    );
    assert(annotation.res.ok, `section_annotations insert failed: ${annotation.res.status}; ${String(annotation.text).slice(0, 160)}`);
    created.annotationId = annotation.data?.[0]?.id;
    assert(created.annotationId, "section_annotations insert did not return id");
    result.annotationInsert = true;

    const reply = await supabaseRest(
      "/rest/v1/annotation_replies?select=id",
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          annotation_id: created.annotationId,
          body: "Codex smoke reply write probe.",
        },
      },
    );
    assert(reply.res.ok, `annotation_replies insert failed: ${reply.res.status}; ${String(reply.text).slice(0, 160)}`);
    created.replyId = reply.data?.[0]?.id;
    result.replyInsert = Boolean(created.replyId);

    if (userId) {
      const reaction = await supabaseRest(
        "/rest/v1/annotation_reactions",
        {
          method: "POST",
          prefer: "return=minimal",
          body: {
            annotation_id: created.annotationId,
            user_id: userId,
            reaction_type: "helpful",
          },
        },
      );
      assert(reaction.res.ok || reaction.res.status === 201, `annotation_reactions insert failed: ${reaction.res.status}; ${String(reaction.text).slice(0, 160)}`);
      created.reaction = true;
      result.reactionInsert = true;

      const readState = await supabaseRest(
        "/rest/v1/annotation_read_states",
        {
          method: "POST",
          prefer: "return=minimal",
          body: {
            annotation_id: created.annotationId,
            user_id: userId,
          },
        },
      );
      assert(readState.res.ok || readState.res.status === 201, `annotation_read_states insert failed: ${readState.res.status}; ${String(readState.text).slice(0, 160)}`);
      created.readState = true;
      result.readStateInsert = true;

      const highlightId = await findExistingHighlightId();
      if (highlightId) {
        const highlightReaction = await supabaseRest(
          "/rest/v1/highlight_reactions?select=id",
          {
            method: "POST",
            prefer: "return=representation",
            body: {
              highlight_id: highlightId,
              user_id: userId,
              reaction_type: "insight",
            },
          },
        );
        assert(highlightReaction.res.ok, `highlight_reactions insert failed: ${highlightReaction.res.status}; ${String(highlightReaction.text).slice(0, 160)}`);
        created.highlightReactionId = highlightReaction.data?.[0]?.id;
        result.highlightReactionInsert = Boolean(created.highlightReactionId);

        const highlightReply = await supabaseRest(
          "/rest/v1/highlight_replies?select=id",
          {
            method: "POST",
            prefer: "return=representation",
            body: {
              highlight_id: highlightId,
              user_id: userId,
              alias: "Codex Smoke",
              color_token: "from-slate-500 to-slate-400",
              body: "Codex smoke highlight reply write probe.",
            },
          },
        );
        assert(highlightReply.res.ok, `highlight_replies insert failed: ${highlightReply.res.status}; ${String(highlightReply.text).slice(0, 160)}`);
        created.highlightReplyId = highlightReply.data?.[0]?.id;
        result.highlightReplyInsert = Boolean(created.highlightReplyId);
      } else {
        result.highlightReactionInsert = "skipped:no_existing_highlight_id";
        result.highlightReplyInsert = "skipped:no_existing_highlight_id";
      }
    } else {
      result.reactionInsert = "skipped:no_existing_user_id";
      result.readStateInsert = "skipped:no_existing_user_id";
      result.highlightReactionInsert = "skipped:no_existing_user_id";
      result.highlightReplyInsert = "skipped:no_existing_user_id";
    }

    const artifactScore = await supabaseRest(
      "/rest/v1/artifact_revision_scores?select=id",
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          section_id: "cat100-supplement/01/01",
          course_id: "cat100-supplement",
          artifact_type: "codex-smoke",
          studio_mode: "trace",
          judgment: "modify",
          trace_score: 6,
          trace_denominator: 8,
          claim_clarity: 0.8,
          evidence_alignment: 0.7,
          revision_depth: 0.7,
          judgment_quality: 0.8,
          transfer_readiness: 0.7,
          specificity_delta: 0.6,
          overall_revision_quality: 0.75,
          diagnostics: { marker },
        },
      },
    );
    assert(artifactScore.res.ok, `artifact_revision_scores insert failed: ${artifactScore.res.status}; ${String(artifactScore.text).slice(0, 160)}`);
    created.artifactScoreId = artifactScore.data?.[0]?.id;
    assert(created.artifactScoreId, "artifact_revision_scores insert did not return id");
    result.artifactScoreInsert = true;
  } finally {
    const cleanupErrors = [];
    if (created.readState && created.annotationId) {
      const del = await supabaseRest(
        `/rest/v1/annotation_read_states?annotation_id=eq.${encodeURIComponent(created.annotationId)}`,
        { method: "DELETE" },
      );
      if (!del.res.ok) cleanupErrors.push(`annotation_read_states:${del.res.status}`);
    }
    if (created.highlightReactionId) {
      const del = await supabaseRest(
        `/rest/v1/highlight_reactions?id=eq.${encodeURIComponent(created.highlightReactionId)}`,
        { method: "DELETE" },
      );
      if (!del.res.ok) cleanupErrors.push(`highlight_reactions:${del.res.status}`);
    }
    if (created.highlightReplyId) {
      const del = await supabaseRest(
        `/rest/v1/highlight_replies?id=eq.${encodeURIComponent(created.highlightReplyId)}`,
        { method: "DELETE" },
      );
      if (!del.res.ok) cleanupErrors.push(`highlight_replies:${del.res.status}`);
    }
    if (created.reaction && created.annotationId) {
      const del = await supabaseRest(
        `/rest/v1/annotation_reactions?annotation_id=eq.${encodeURIComponent(created.annotationId)}`,
        { method: "DELETE" },
      );
      if (!del.res.ok) cleanupErrors.push(`annotation_reactions:${del.res.status}`);
    }
    if (created.replyId) {
      const del = await supabaseRest(
        `/rest/v1/annotation_replies?id=eq.${encodeURIComponent(created.replyId)}`,
        { method: "DELETE" },
      );
      if (!del.res.ok) cleanupErrors.push(`annotation_replies:${del.res.status}`);
    }
    if (created.annotationId) {
      const del = await supabaseRest(
        `/rest/v1/section_annotations?id=eq.${encodeURIComponent(created.annotationId)}`,
        { method: "DELETE" },
      );
      if (!del.res.ok) cleanupErrors.push(`section_annotations:${del.res.status}`);
    }
    if (created.artifactScoreId) {
      const del = await supabaseRest(
        `/rest/v1/artifact_revision_scores?id=eq.${encodeURIComponent(created.artifactScoreId)}`,
        { method: "DELETE" },
      );
      if (!del.res.ok) cleanupErrors.push(`artifact_revision_scores:${del.res.status}`);
    }
    if (cleanupErrors.length > 0) {
      throw new Error(`optional write probe cleanup failed: ${cleanupErrors.join(", ")}`);
    }
    result.cleanup = true;
  }

  return result;
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, "frontend", ".env"));
  loadEnvFile(path.join(repoRoot, "frontend", ".env.production"));

  const options = parseArgs(process.argv.slice(2));
  const app = await smokeApp(options.appUrl);
  const access = await smokeAccessGate(options.appUrl, options.requireAccess);
  const worker = await smokeWorker(options.workerUrl, app.contentVersion);
  const provenance = await pollSupabaseDecision(
    worker.decisionId,
    options.requireProvenance,
  );
  const tableCheck = options.checkTables
    ? await checkSupabaseTables(options.requireTables)
    : undefined;
  const optionalWriteProbe = options.probeOptionalWrites
    ? await probeOptionalWrites()
    : undefined;

  console.log(JSON.stringify({
    ok: true,
    app,
    access,
    worker,
    provenance,
    ...(tableCheck ? { tableCheck } : {}),
    ...(optionalWriteProbe ? { optionalWriteProbe } : {}),
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    error: err.message,
  }, null, 2));
  process.exit(1);
});
