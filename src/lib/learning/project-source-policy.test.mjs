import test from "node:test";
import assert from "node:assert/strict";
import { selectRelevantProjectFiles } from "./project-source-policy.mjs";

const files = [
  { original_filename: "README.md", content: "readme" },
  { original_filename: "src/components/profile-card.jsx", content: "profile component" },
  { original_filename: "package.json", content: "{}" },
  { original_filename: "src/app/page.jsx", content: "home page" },
  { original_filename: "src/lib/payments/stripe-client.ts", content: "payments" },
  { original_filename: "next.config.mjs", content: "config" },
];

test("ranks project manifests and application entry points ahead of generic files", () => {
  const result = selectRelevantProjectFiles("update the home page", files, 6);
  assert.deepEqual(
    result.slice(0, 3).map((file) => file.original_filename),
    ["package.json", "src/app/page.jsx", "next.config.mjs"],
  );
});

test("uses prompt terms to prioritize matching file paths without losing stable ordering", () => {
  const result = selectRelevantProjectFiles("change the profile card component", files, 6);
  const profileIndex = result.findIndex((file) => file.original_filename === "src/components/profile-card.jsx");
  const pageIndex = result.findIndex((file) => file.original_filename === "src/app/page.jsx");
  assert.ok(profileIndex >= 0);
  assert.ok(profileIndex < pageIndex);
});

test("caps selection at eight complete files and handles invalid inputs safely", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    original_filename: `src/file-${index}.js`,
    content: String(index),
  }));
  assert.equal(selectRelevantProjectFiles("update code", many, 99).length, 8);
  assert.equal(selectRelevantProjectFiles("update code", many, -1).length, 0);
  assert.deepEqual(selectRelevantProjectFiles("anything", null), []);
});

test("normalizes Unicode prompt and path tokens before matching", () => {
  const unicodeFiles = [
    { original_filename: "src/café-menu.jsx", content: "menu" },
    { original_filename: "src/other.jsx", content: "other" },
  ];
  const result = selectRelevantProjectFiles("update cafe\u0301 menu", unicodeFiles, 2);
  assert.equal(result[0].original_filename, "src/café-menu.jsx");
});
