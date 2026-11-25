const ALLOWED_TOOL_NAMES = new Set([
  "list_approved_source_files",
  "submit_change_plan",
  "read_approved_source_file",
  "propose_source_changes",
]);
const MAX_TOOL_CALLS_PER_RESPONSE = 8;
const MAX_TOOL_ARGUMENT_BYTES = 16 * 1024;
const TOOL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function validateAgentToolCalls(calls, { phase = "execute" } = {}) {
  if (!Array.isArray(calls) || calls.length < 1 || calls.length > MAX_TOOL_CALLS_PER_RESPONSE) {
    return { ok: false, error: "The agent returned an invalid number of tool calls." };
  }
  const ids = new Set();
  const validated = [];
  for (const call of calls) {
    const id = call?.id;
    const name = call?.function?.name;
    const rawArguments = call?.function?.arguments;
    if (typeof id !== "string" || !TOOL_ID_PATTERN.test(id) || ids.has(id)) {
      return { ok: false, error: "The agent returned a missing or duplicate tool-call identifier." };
    }
    ids.add(id);
    if (!ALLOWED_TOOL_NAMES.has(name) || (phase === "plan" && !["list_approved_source_files", "submit_change_plan"].includes(name))) {
      return { ok: false, error: "The agent requested a tool that is not allowed in this phase." };
    }
    if (typeof rawArguments !== "string" || Buffer.byteLength(rawArguments, "utf8") > MAX_TOOL_ARGUMENT_BYTES) {
      return { ok: false, error: "The agent returned tool arguments that exceed the safe limit." };
    }
    let args;
    try { args = JSON.parse(rawArguments); } catch {
      return { ok: false, error: "The agent returned malformed tool arguments." };
    }
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      return { ok: false, error: "Tool arguments must be a JSON object." };
    }
    validated.push(Object.freeze({ id, name, args }));
  }
  return { ok: true, calls: Object.freeze(validated) };
}
