import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/build/project/route.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/20261118000100_aahana_build_locks.sql", import.meta.url), "utf8");

test("project Build Mode uses an atomic database lock rather than process-local memory", () => {
  assert.match(route, /acquire_aahana_build_lock/);
  assert.match(route, /release_aahana_build_lock/);
  assert.doesNotMatch(route, /activeBuildUsers/);
  assert.match(route, /lockAcquired !== true/);
  assert.match(route, /if \(lockError\)/);
});

test("build lock is unique per account, expires safely and can only be released by its owner token", () => {
  assert.match(migration, /owner_id uuid primary key references auth\.users/);
  assert.match(migration, /on conflict \(owner_id\) do update/);
  assert.match(migration, /expires_at <= now\(\)/);
  assert.match(migration, /interval '4 minutes'/);
  assert.match(migration, /where owner_id = caller_id and lock_token = p_lock_token/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /grant execute on function public\.acquire_aahana_build_lock\(uuid, uuid\) to authenticated/);
});

test("build route passes request cancellation into the sandbox and returns 499 on disconnect", () => {
  assert.match(route, /signal:\s*request\.signal/);
  assert.match(route, /if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\)/);
});


test("Build Mode stops loading private project files after the caller disconnects", () => {
  assert.match(route, /for \(const file of eligible\) \{\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\)/);
  assert.match(route, /storage\.from\("aahana-private"\)\.download\(file\.object_path\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\)/);
  assert.match(route, /const content = await blob\.text\(\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\)/);
  assert.match(route, /if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*const files = validateWorkspaceFiles/);
});
