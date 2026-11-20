import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const listRoute = readFileSync(new URL("./route.js", import.meta.url), "utf8");
const detailRoute = readFileSync(new URL("./[id]/route.js", import.meta.url), "utf8");

test("conversation list stops after cancelled authentication and aborts its database read", () => {
  assert.match(listRoute, /await createClient\(\);\s*if \(request\.signal\.aborted\)[\s\S]*?await supabase\.auth\.getUser\(\);\s*if \(request\.signal\.aborted\)/);
  assert.match(listRoute, /\.limit\(50\)\.abortSignal\(request\.signal\);\s*if \(request\.signal\.aborted\)/);
});

test("conversation detail stops after cancelled authentication and aborts both database reads", () => {
  assert.match(detailRoute, /await createClient\(\);\s*if \(request\.signal\.aborted\)[\s\S]*?await supabase\.auth\.getUser\(\);\s*if \(request\.signal\.aborted\)/);
  assert.match(detailRoute, /await params;\s*if \(request\.signal\.aborted\)/);
  assert.equal((detailRoute.match(/\.abortSignal\(request\.signal\)/g) || []).length, 2);
  assert.equal((detailRoute.match(/if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);/g) || []).length >= 4, true);
});
