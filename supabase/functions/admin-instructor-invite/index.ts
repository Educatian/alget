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

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ detail: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json({ detail: "Instructor invitations are not configured" }, 503);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return json({ detail: "Invalid or expired administrator session" }, 401);
  const operator = await userResponse.json();
  if (!["admin", "course_admin"].includes(operator?.app_metadata?.role)) {
    return json({ detail: "Course administrator role required" }, 403);
  }

  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email || "").trim().toLowerCase();
  const displayName = String(payload.display_name || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2 || displayName.length > 120) {
    return json({ detail: "Valid instructor name and email are required" }, 422);
  }

  const inviteBody: Record<string, unknown> = {
    email,
    data: { display_name: displayName, role: "instructor", invited_by: operator.id },
  };
  if (payload.redirect_url) inviteBody.redirect_to = String(payload.redirect_url);
  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const inviteResponse = await fetch(`${supabaseUrl}/auth/v1/invite`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(inviteBody),
  });
  const invitedUser = await inviteResponse.json().catch(() => ({}));
  if (!inviteResponse.ok) return json({ detail: invitedUser.msg || invitedUser.message || "Instructor invitation failed" }, inviteResponse.status);
  if (!invitedUser.id) return json({ detail: "Identity provider returned no instructor id" }, 502);

  const roleResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${invitedUser.id}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ app_metadata: { role: "instructor" } }),
  });
  if (!roleResponse.ok) return json({ detail: "Instructor was invited but role assignment failed" }, 502);

  return json({ id: invitedUser.id, email: invitedUser.email || email, status: "invited" }, 201);
});
