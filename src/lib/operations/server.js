import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let serviceClient;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!serviceClient) {
    serviceClient = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return serviceClient;
}

/**
 * Record a minimal platform event. Never pass prompts, message bodies, auth data,
 * tokens, or user-identifying details. Missing service credentials fail closed.
 */
export async function logSystemEvent({
  eventType,
  severity = "info",
  source,
  summary,
  metadata = {},
}) {
  const client = getServiceClient();
  if (!client) return { recorded: false, reason: "service_role_unavailable" };

  const safeMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? Object.fromEntries(Object.entries(metadata).filter(([key, value]) =>
        /^[a-zA-Z0-9_]{1,40}$/.test(key) &&
        ["string", "number", "boolean"].includes(typeof value)
      ).slice(0, 20))
    : {};

  const { error } = await client.from("aahana_system_events").insert({
    event_type: String(eventType || "unknown").slice(0, 80),
    severity: ["info", "warning", "error", "critical"].includes(severity) ? severity : "info",
    source: String(source || "unknown").slice(0, 80),
    summary: String(summary || "Unspecified system event").replace(/[\\r\\n\\t]+/g, " ").slice(0, 240),
    metadata: safeMetadata,
  });

  if (error) {
    console.error("Aahana system event write failed:", error.message);
    return { recorded: false, reason: "write_failed" };
  }
  return { recorded: true };
}

/**
 * Record a reliability event in the authenticated user's private workspace.
 * This path uses the user's session and RLS; it does not require a service key.
 */
export async function recordUserOpsEvent(supabase, userId, {
  severity = "error",
  source = "self_ops",
  summary,
  details = {},
}) {
  if (!supabase || !userId || !summary) return { recorded: false, reason: "invalid_input" };

  const safeDetails = details && typeof details === "object" && !Array.isArray(details)
    ? Object.fromEntries(Object.entries(details).filter(([key, value]) =>
        /^[a-zA-Z0-9_]{1,40}$/.test(key) &&
        ["string", "number", "boolean"].includes(typeof value)
      ).slice(0, 20))
    : {};

  const { error } = await supabase.from("aahana_ops_events").insert({
    user_id: userId,
    event_type: "workflow_error",
    severity: ["info", "warning", "error", "critical"].includes(severity) ? severity : "error",
    source: ["workspace", "executive", "self_ops"].includes(source) ? source : "self_ops",
    summary: String(summary).replace(/[\\r\\n\\t]+/g, " ").slice(0, 240),
    details: safeDetails,
  });

  if (error) {
    console.error("Aahana user operations event write failed:", error.message);
    return { recorded: false, reason: "write_failed" };
  }
  return { recorded: true };
}
