import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/chat/route.js", import.meta.url), "utf8");

test("chat route exits with 499 after cancellation during authentication and request parsing", () => {
  assert.match(route, /await createClient\(\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*const \{ data: \{ user \}, error: authError \} = await supabase\.auth\.getUser\(\);\s*if \(request\.signal\.aborted\)/);
  assert.match(route, /body = await request\.json\(\);\s*\} catch \{\s*if \(request\.signal\.aborted\)/);
});

test("chat route checks disconnects after each conversation and history database boundary", () => {
  assert.match(route, /\.maybeSingle\(\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*if \(projectError/);
  assert.match(route, /\.maybeSingle\(\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*if \(error \|\| !existing\)/);
  assert.match(route, /\.limit\(20\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);/);
});

test("chat route stops before optional private-memory reads after disconnect", () => {
  assert.match(route, /\.maybeSingle\(\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*if \(memorySettingsError\)/);
  assert.match(route, /\.limit\(30\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);/);
});
