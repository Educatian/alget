const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ detail: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization.toLowerCase().startsWith("bearer ")) return json({ detail: "Instructor review is not configured" }, 503);
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  if (!userResponse.ok) return json({ detail: "Invalid or expired administrator session" }, 401);
  const operator = await userResponse.json();
  if (!["admin", "course_admin"].includes(operator?.app_metadata?.role)) return json({ detail: "Course administrator role required" }, 403);
  const payload = await request.json().catch(() => ({}));
  const profileId = String(payload.profile_id || "").trim();
  const decision = String(payload.decision || "").trim().toLowerCase();
  const note = String(payload.note || "").trim().slice(0, 1000);
  if (!profileId || !["approve", "reject"].includes(decision)) return json({ detail: "profile_id and approve/reject decision are required" }, 422);
  const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/instructor_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,user_id,email,status&limit=1`, { headers: adminHeaders });
  const profiles = await profileResponse.json().catch(() => []);
  const profile = profiles?.[0];
  if (!profile) return json({ detail: "Instructor application not found" }, 404);
  if (!["pending_approval", "invited"].includes(profile.status)) return json({ detail: `Application is already ${profile.status}` }, 409);
  const nextStatus = decision === "approve" ? "active" : "rejected";
  const updateResponse = await fetch(`${supabaseUrl}/rest/v1/instructor_profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: "PATCH", headers: { ...adminHeaders, Prefer: "return=representation" }, body: JSON.stringify({ status: nextStatus, updated_at: new Date().toISOString() }),
  });
  if (!updateResponse.ok) return json({ detail: "Could not update instructor application" }, 502);
  if (profile.user_id) {
    const roleResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(profile.user_id)}`, {
      method: "PUT", headers: adminHeaders,
      body: JSON.stringify({ app_metadata: { role: decision === "approve" ? "instructor" : "instructor_rejected", instructor_status: nextStatus } }),
    });
    if (!roleResponse.ok) return json({ detail: "Application updated but account permission update failed" }, 502);
  }
  await fetch(`${supabaseUrl}/rest/v1/admin_audit_events`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ actor_id: operator.id, action: `instructor.${decision}d`, entity_type: "instructor", entity_id: profileId, detail: { note, email: profile.email } }) });
  return json({ profile_id: profileId, status: nextStatus, role: decision === "approve" ? "instructor" : "instructor_rejected" });
});
