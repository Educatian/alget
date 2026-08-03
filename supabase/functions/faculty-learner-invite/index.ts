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
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2 || displayName.length > 120 || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(courseId) || cohortId.length < 2 || cohortId.length > 120 || cohortLabel.length < 2 || cohortLabel.length > 120) {
    return json({ detail: "Valid learner name, email, course, and cohort are required" }, 422);
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

  const learnerHash = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  const inviteBody = {
    email,
    data: { display_name: displayName, course_id: courseId, cohort_id: cohortId, cohort_label: cohortLabel, learner_hash: learnerHash },
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
      user_id: invitedUser.id, email, display_name: displayName, cohort_id: cohortId, cohort_label: cohortLabel,
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
