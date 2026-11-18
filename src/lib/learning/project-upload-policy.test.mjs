import test from "node:test";
import assert from "node:assert/strict";
import { getProjectUploadKind, PROJECT_CODE_EXTENSIONS } from "./project-upload-policy.mjs";

test("accepts common frontend, backend and configuration source files", () => {
  for (const name of [
    "App.vue", "Widget.svelte", "page.astro", "layout.mdx",
    "server.go", "lib.rs", "Main.java", "Main.kt", "App.swift",
    "handler.php", "worker.rb", "main.dart", "schema.prisma",
    "query.graphql", "service.proto", "main.py", "notebook.ipynb",
    "styles.scss", "settings.jsonc", "infra.tf", "build.gradle",
    "Program.cs", "main.cpp", "script.lua", "module.ex",
  ]) {
    assert.equal(getProjectUploadKind(name, "application/octet-stream"), "code", name);
  }
  assert.ok(PROJECT_CODE_EXTENSIONS.length >= 70);
});

test("keeps supported document and image uploads available", () => {
  assert.equal(getProjectUploadKind("brief.pdf", "application/pdf"), "document");
  assert.equal(getProjectUploadKind("notes.md", "text/markdown"), "code");
  assert.equal(getProjectUploadKind("data.csv", "text/csv"), "code");
  assert.equal(getProjectUploadKind("photo.webp", "image/webp"), "document");
});

test("rejects environment secrets, keys, certificates and unsupported binaries", () => {
  for (const name of [".env", ".env.local", ".env.production", "private.pem", "server.key", "archive.zip", "app.exe"]) {
    assert.equal(getProjectUploadKind(name, "application/octet-stream"), null, name);
  }
});
