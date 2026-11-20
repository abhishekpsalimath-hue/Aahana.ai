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

test("failed user-message persistence scopes new-conversation cleanup to its owner", () => {
  assert.match(route, /if \(messageError \|\| !savedUserMessage\) \{\s*if \(createdConversation\) \{\s*await supabase\.from\("conversations"\)\.delete\(\)\.eq\("id", conversationId\)\.eq\("user_id", user\.id\);\s*\}/);
});

test("aborted new conversation creation is cleaned up before returning HTTP 499", () => {
  assert.match(route, /if \(created\) \{\s*conversationId = created\.id;\s*createdConversation = true;\s*\}\s*if \(request\.signal\.aborted\) \{\s*if \(createdConversation\) \{\s*await supabase\.from\("conversations"\)\.delete\(\)\.eq\("id", conversationId\)\.eq\("user_id", user\.id\);\s*\}\s*return new Response\(null, \{ status: 499 \}\);/);
});

test("aborted user-message insert cleans up only an empty newly-created conversation", () => {
  assert.match(route, /if \(request\.signal\.aborted\) \{\s*if \(createdConversation && !savedUserMessage\) \{\s*await supabase\.from\("conversations"\)\.delete\(\)\.eq\("id", conversationId\)\.eq\("user_id", user\.id\);\s*\}\s*return new Response\(null, \{ status: 499 \}\);/);
});

test("private-memory lookup exceptions stop immediately when the client disconnects", () => {
  assert.match(route, /\} catch \(memoryError\) \{\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*console\.error\("Aahana private memory retrieval failed:"/);
});

test("assistant reply timestamp updates are scoped to the authenticated conversation owner", () => {
  const timestampUpdateCalls = route.split('.update({ updated_at: new Date().toISOString() })').slice(1);
  const ownerScopedUpdates = timestampUpdateCalls.filter((segment) => {
    const updateChain = segment.slice(0, 240);
    return updateChain.includes('.eq("id", conversationId)') && updateChain.includes('.eq("user_id", user.id)');
  });
  assert.equal(ownerScopedUpdates.length, 2);
});;
