const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function headers(key: string, authorization = `Bearer ${key}`) {
  return { apikey: key, Authorization: authorization, "Content-Type": "application/json" };
}

async function rest(url: string, key: string, path: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(key), ...(init.headers || {}) },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ detail: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json({ detail: "Learner invitations are not configured" }, 503);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: headers(anonKey, authorization) });
  if (!userResponse.ok) return json({ detail: "Invalid or expired instructor session" }, 401);
  const operator = await userResponse.json();
  const role = operator?.app_metadata?.role;
  if (!["instructor", "admin", "course_admin"].includes(role)) return json({ detail: "Instructor role required" }, 403);

  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email || "").trim().toLowerCase();
  const displayName = String(payload.display_name || "").trim();
  const courseId = String(payload.course_id || "").trim();
  const cohortId = String(payload.cohort_id || `${courseId}-instructor`).trim();
  const cohortLabel = String(payload.cohort_label || "Instructor roster").trim();
  const isEngineeringStudy = courseId === "bio-inspired" && cohortId === "bio-inspired-intervention-2026";
  const studyId = String(payload.study_id || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2 || displayName.length > 120 || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(courseId) || cohortId.length < 2 || cohortId.length > 120 || cohortLabel.length < 2 || cohortLabel.length > 120) {
    return json({ detail: "Valid learner name, email, course, and cohort are required" }, 422);
  }
  if (isEngineeringStudy && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(studyId)) {
    return json({ detail: "A valid random UUIDv4 Study ID is required for the engineering study" }, 422);
  }
  if (isEngineeringStudy && role === "instructor") {
    return json({ detail: "Only an accountable research administrator may bind Study IDs to invited accounts" }, 403);
  }

  if (role === "instructor") {
    const profileResponse = await rest(supabaseUrl, serviceKey, `instructor_profiles?user_id=eq.${encodeURIComponent(operator.id)}&status=eq.active&select=id&limit=1`);
    const profiles = await profileResponse.json().catch(() => []);
    const profileId = profiles?.[0]?.id;
    if (!profileId) return json({ detail: "Active instructor profile required" }, 403);
    const courseResponse = await rest(supabaseUrl, serviceKey, `managed_courses?course_key=eq.${encodeURIComponent(courseId)}&owner_instructor_id=eq.${encodeURIComponent(profileId)}&select=course_key&limit=1`);
    const courses = await courseResponse.json().catch(() => []);
    if (!courses?.length) return json({ detail: "You can only invite learners to an assigned course" }, 403);
  }

  const existingRosterResponse = await rest(supabaseUrl, serviceKey, `cohort_learners?email=eq.${encodeURIComponent(email)}&select=user_id,course_id&limit=5`);
  const existingRoster = await existingRosterResponse.json().catch(() => []);
  if (Array.isArray(existingRoster) && existingRoster.some((row) => row.course_id !== courseId)) {
    return json({ detail: "This learner is already assigned to another course. Ask an administrator to manage cross-course enrollment." }, 409);
  }

  let learnerHash = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  if (isEngineeringStudy) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`alget-study-link-v1:${studyId}`));
    const studyLinkHash = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
    const scheduleResponse = await rest(
      supabaseUrl,
      serviceKey,
      `engineering_study_allocation_schedule?study_link_hash=eq.${studyLinkHash}&experiment_key=eq.alget-bio-inspired-agentic-rct-v1&course_id=eq.bio-inspired&select=study_link_hash,claimed_user_id&limit=1`,
    );
    const schedule = await scheduleResponse.json().catch(() => []);
    if (!scheduleResponse.ok || !Array.isArray(schedule) || schedule.length !== 1) {
      return json({ detail: "The Study ID does not have a pre-provisioned concealed allocation" }, 409);
    }
    if (schedule[0].claimed_user_id) {
      return json({ detail: "The Study ID allocation is already bound to an account" }, 409);
    }
    const duplicateResponse = await rest(
      supabaseUrl,
      serviceKey,
      `cohort_learners?cohort_id=eq.bio-inspired-intervention-2026&learner_hash=eq.${encodeURIComponent(studyId)}&select=user_id&limit=1`,
    );
    const duplicate = await duplicateResponse.json().catch(() => []);
    if (!duplicateResponse.ok || (Array.isArray(duplicate) && duplicate.length)) {
      return json({ detail: "The Study ID is already present in the restricted roster" }, 409);
    }
    learnerHash = studyId;
  }
  const researchAlias = `Study Learner ${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const inviteBody = {
    email,
    data: { display_name: isEngineeringStudy ? researchAlias : displayName, course_id: courseId, cohort_id: cohortId, cohort_label: cohortLabel, learner_hash: learnerHash },
    redirect_to: String(payload.redirect_url || `${supabaseUrl}/`),
  };
  const adminHeaders = headers(serviceKey);
  const inviteResponse = await fetch(`${supabaseUrl}/auth/v1/invite`, { method: "POST", headers: adminHeaders, body: JSON.stringify(inviteBody) });
  const invitedUser = await inviteResponse.json().catch(() => ({}));
  if (!inviteResponse.ok) return json({ detail: invitedUser.msg || invitedUser.message || "Learner invitation failed" }, inviteResponse.status);
  if (!invitedUser.id) return json({ detail: "Identity provider returned no learner id" }, 502);

  const rosterResponse = await rest(supabaseUrl, serviceKey, "cohort_learners", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: invitedUser.id, email, display_name: isEngineeringStudy ? researchAlias : displayName, cohort_id: cohortId, cohort_label: cohortLabel,
      course_id: courseId, learner_hash: learnerHash, status: "invited", invited_by: operator.id, invited_at: new Date().toISOString(),
      profile: { source: "instructor-invite" },
    }),
  });
  if (!rosterResponse.ok) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${invitedUser.id}`, { method: "DELETE", headers: adminHeaders });
    const detail = await rosterResponse.text();
    return json({ detail: `Learner invitation could not be added to the course roster: ${detail.slice(0, 240)}` }, 502);
  }

  return json({ id: invitedUser.id, email, display_name: displayName, course_id: courseId, status: "invited" }, 201);
});
