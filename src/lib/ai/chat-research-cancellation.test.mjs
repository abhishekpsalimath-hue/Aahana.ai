import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/chat/route.js", import.meta.url), "utf8");

test("buffered research checks client cancellation after provider parsing and before persistence", () => {
  assert.match(route, /researchPayload = await upstream\.json\(\);\s*const abortResponse = getClientAbortResponse\(request\.signal\);\s*if \(abortResponse\) return abortResponse;/);
  assert.match(route, /const abortBeforeSave = getClientAbortResponse\(request\.signal\);\s*if \(abortBeforeSave\) return abortBeforeSave;\s*const \{ error: saveError \} = await supabase\.rpc\("save_ai_reply"/);
});
