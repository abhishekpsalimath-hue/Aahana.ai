import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL("./20261127000100_aahana_durable_video_jobs.sql", import.meta.url));
const migration = await readFile(migrationPath, "utf8");

test("authenticated users cannot directly create or update durable video jobs", () => {
  assert.match(migration, /revoke all on public\.aahana_video_jobs from anon, authenticated/i);
  assert.match(migration, /grant select on public\.aahana_video_jobs to authenticated/i);
  assert.match(migration, /grant select, insert, update on public\.aahana_video_jobs to service_role/i);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|all)[^;]*\bto\s+authenticated/i);
  assert.doesNotMatch(migration, /for\s+(?:insert|update)\s+to\s+authenticated/i);
});

test("authenticated cancellation is exposed only through an owner-scoped definer function", () => {
  assert.match(migration, /function public\.cancel_aahana_video_job\(p_job_id text\)[\s\S]*?security definer/i);
  assert.match(migration, /where job_id = p_job_id and owner_id = v_owner_id/i);
  assert.match(migration, /if v_job\.state in \('queued', 'running'\) then/i);
  assert.match(migration, /grant execute on function public\.cancel_aahana_video_job\(text\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.cancel_aahana_video_job\(text\) from public, anon/i);
});

test("cancellation function uses a valid PostgreSQL dollar-quoted body", () => {
  assert.ok(migration.includes("as $$\ndeclare"));
  assert.ok(migration.includes("\n$$;\n\nrevoke all on function public.cancel_aahana_video_job"));
  assert.doesNotMatch(migration, /as \$\s*declare/i);
});
