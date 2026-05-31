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
  };
  for (const arg of argv) {
    if (arg === "--require-access") options.requireAccess = true;
    else if (arg === "--require-provenance") options.requireProvenance = true;
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
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    if (requireProvenance) {
      throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    return { checked: false, found: false, note: "missing local Supabase service env" };
  }

  const base = supabaseUrl.replace(/\/+$/, "");
  const query =
    `/rest/v1/adaptive_decisions?decision_id=eq.${encodeURIComponent(decisionId)}` +
    "&select=decision_id,source,content_version,section_id,created_at";
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
          source: rows[0].source,
          sectionId: rows[0].section_id,
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

  console.log(JSON.stringify({
    ok: true,
    app,
    access,
    worker,
    provenance,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    error: err.message,
  }, null, 2));
  process.exit(1);
});
