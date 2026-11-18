import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeProjectDependencies,
  analyzeProjectContracts,
  selectProjectFilesWithDependencies,
} from "./project-dependency-policy.mjs";

const projectFiles = [
  {
    path: "src/app/page.jsx",
    content: 'import ProfileCard from "../components/profile-card";\nimport { getProfile } from "../lib/profile-service.js";\nexport default function Page() { return <ProfileCard data={getProfile()} />; }',
  },
  {
    path: "src/components/profile-card.jsx",
    content: 'import React from "react";\nexport default function ProfileCard({ data }) { return <div>{data.name}</div>; }',
  },
  {
    path: "src/lib/profile-service.js",
    content: 'import { normalizeName } from "./normalize.js";\nexport function getProfile() { return { name: normalizeName("Ada") }; }',
  },
  {
    path: "src/lib/normalize.js",
    content: 'export function normalizeName(value) { return value.trim(); }',
  },
  {
    path: "src/components/unrelated.jsx",
    content: 'export default function Unrelated() { return null; }',
  },
  {
    path: "src/app/api/profile/route.js",
    content: 'import { getProfile } from "../../../lib/profile-service.js";\nexport async function GET() { return Response.json(getProfile()); }',
  },
];

test("detects relative imports and reverse dependents across source extensions", () => {
  const graph = analyzeProjectDependencies(projectFiles);
  assert.ok(graph.dependencies.get("src/app/page.jsx").has("src/components/profile-card.jsx"));
  assert.ok(graph.dependencies.get("src/app/page.jsx").has("src/lib/profile-service.js"));
  assert.ok(graph.dependencies.get("src/lib/profile-service.js").has("src/lib/normalize.js"));
  assert.ok(graph.dependents.get("src/lib/profile-service.js").has("src/app/page.jsx"));
  assert.ok(graph.dependents.get("src/lib/profile-service.js").has("src/app/api/profile/route.js"));
});

test("collects external package references without treating them as project files", () => {
  const graph = analyzeProjectDependencies(projectFiles);
  assert.ok(graph.external.some((item) => item.from === "src/components/profile-card.jsx" && item.packageName === "react"));
});

test("expands prompt matches to connected imports and callers within the file cap", () => {
  const result = selectProjectFilesWithDependencies("change the profile card component", projectFiles, 8, 2);
  const paths = result.files.map((file) => file.path);
  assert.ok(paths.includes("src/components/profile-card.jsx"));
  assert.ok(paths.includes("src/app/page.jsx"));
  assert.ok(paths.includes("src/lib/profile-service.js"));
  assert.ok(result.relationships.some((edge) => edge.from === "src/app/page.jsx" && edge.to === "src/components/profile-card.jsx"));
  assert.ok(paths.length <= 8);
});

test("does not invent unresolved relative paths or resolve package aliases by guessing", () => {
  const files = [{
    path: "src/page.js",
    content: 'import Missing from "./missing";\nimport Alias from "@/components/alias";\nimport React from "react";',
  }];
  const graph = analyzeProjectDependencies(files);
  assert.equal(graph.dependencies.get("src/page.js").size, 0);
  assert.ok(graph.unresolved.some((item) => item.specifier === "./missing"));
  assert.ok(graph.unresolved.some((item) => item.specifier === "@/components/alias"));
  assert.ok(graph.external.some((item) => item.packageName === "react"));
});

test("resolves tsconfig paths aliases and baseUrl imports conservatively", () => {
  const files = [
    { path: "tsconfig.json", content: JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"],
          "@ui/*": ["src/components/*"],
          "@exact": ["src/lib/exact.js"],
        },
      },
    }) },
    { path: "src/app/page.tsx", content: [
      'import Card from "@/components/card";',
      'import Button from "@ui/button";',
      'import exact from "@exact";',
      'import helper from "lib/helper";',
      'import external from "react";',
    ].join("\n") },
    { path: "src/components/card.tsx", content: "export default function Card() {}" },
    { path: "src/components/button/index.tsx", content: "export default function Button() {}" },
    { path: "src/lib/exact.js", content: "export default 1;" },
    { path: "lib/helper.js", content: "export default 2;" },
  ];
  const graph = analyzeProjectDependencies(files);
  const dependencies = graph.dependencies.get("src/app/page.tsx");
  assert.ok(dependencies.has("src/components/card.tsx"));
  assert.ok(dependencies.has("src/components/button/index.tsx"));
  assert.ok(dependencies.has("src/lib/exact.js"));
  assert.ok(dependencies.has("lib/helper.js"));
  assert.ok(graph.external.some((item) => item.packageName === "react"));
  assert.equal(graph.aliasConfig.configPath, "tsconfig.json");
  assert.equal(graph.aliasConfig.pathMappings, 3);
});

test("parses JSONC tsconfig comments and trailing commas without corrupting string values", () => {
  const files = [
    { path: "tsconfig.json", content: `{
      // project aliases
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@/*": ["src/*"],
        },
      },
      "note": "https://example.com/a//b",
    }` },
    { path: "src/page.ts", content: 'import Card from "@/components/card";' },
    { path: "src/components/card.ts", content: "export default 1;" },
  ];
  const graph = analyzeProjectDependencies(files);
  assert.ok(graph.dependencies.get("src/page.ts").has("src/components/card.ts"));
  assert.equal(graph.aliasConfig.invalid, false);
});

test("uses jsconfig when tsconfig is absent and leaves unknown aliases unresolved", () => {
  const files = [
    { path: "jsconfig.json", content: JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "~/*": ["app/*"] } } }) },
    { path: "src/page.js", content: 'import Known from "~/known";\nimport Unknown from "~/missing";' },
    { path: "app/known.js", content: "export default 1;" },
  ];
  const graph = analyzeProjectDependencies(files);
  assert.ok(graph.dependencies.get("src/page.js").has("app/known.js"));
  assert.ok(graph.unresolved.some((item) => item.specifier === "~/missing"));
  assert.equal(graph.aliasConfig.configPath, "jsconfig.json");
});

test("does not guess when the project alias configuration is invalid JSON", () => {
  const files = [
    { path: "tsconfig.json", content: "{ invalid json" },
    { path: "src/page.js", content: 'import Alias from "@/components/alias";' },
  ];
  const graph = analyzeProjectDependencies(files);
  assert.equal(graph.dependencies.get("src/page.js").size, 0);
  assert.ok(graph.unresolved.some((item) => item.specifier === "@/components/alias"));
  assert.equal(graph.aliasConfig.invalid, true);
});

test("maps imported bindings to target exports and flags missing named exports", () => {
  const files = [
    { path: "src/page.tsx", content: [
      'import Card, { type CardProps, formatName as format } from "@/components/card";',
      'import { missingExport } from "@/components/card";',
      'import type { CardProps as ReadonlyCardProps } from "@/components/card";',
      'import type DefaultCard from "@/components/card";',
      'import * as utils from "@/lib/utils";',
    ].join("\n") },
    { path: "src/components/card.tsx", content: [
      'export interface CardProps { title: string }',
      'export function formatName(value: string) { return value; }',
      'export default function Card({ title }: CardProps) { return title; }',
    ].join("\n") },
    { path: "src/lib/utils.ts", content: 'export const safe = true;' },
    { path: "tsconfig.json", content: JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }) },
  ];
  const result = analyzeProjectContracts(files);
  assert.ok(result.bindingRelationships.some((edge) => edge.imported === "default" && edge.to === "src/components/card.tsx"));
  assert.ok(result.bindingRelationships.some((edge) => edge.imported === "CardProps" && edge.status === "matched"));
  assert.ok(result.bindingRelationships.some((edge) => edge.imported === "formatName" && edge.local === "format"));
  assert.ok(result.bindingRelationships.some((edge) => edge.imported === "CardProps" && edge.local === "ReadonlyCardProps"));
  assert.ok(result.bindingRelationships.some((edge) => edge.imported === "default" && edge.local === "DefaultCard"));
  assert.ok(result.bindingRelationships.some((edge) => edge.imported === "*" && edge.to === "src/lib/utils.ts"));
  assert.ok(result.unresolvedBindings.some((edge) => edge.imported === "missingExport"));
  const card = result.modules.find((module) => module.path === "src/components/card.tsx");
  assert.ok(card.exports.some((item) => item.name === "CardProps" && item.kind === "interface"));
  assert.ok(card.propTypes.some((item) => item.component === "Card" && item.typeName === "CardProps"));
});

test("reports route handler exports and avoids inventing bindings for absent source files", () => {
  const result = analyzeProjectContracts([
    { path: "src/app/api/items/route.js", content: 'export async function GET(request) { const q = request.nextUrl.searchParams; return Response.json(q); }\nexport async function POST(request) { const body = await request.json(); return NextResponse.json(body); }' },
    { path: "src/client.js", content: 'import { GET } from "./app/api/items/route.js";' },
  ]);
  const route = result.modules.find((module) => module.path.endsWith("/route.js"));
  assert.ok(route.exports.some((item) => item.name === "GET"));
  assert.ok(route.exports.some((item) => item.name === "POST"));
  assert.ok(route.apiHandlers.some((item) => item.method === "GET" && item.readsSearchParams && item.returnsJson && !item.readsJsonBody));
  assert.ok(route.apiHandlers.some((item) => item.method === "POST" && item.readsJsonBody && item.usesNextResponse && !item.readsSearchParams));
  assert.ok(result.bindingRelationships.some((edge) => edge.imported === "GET" && edge.status === "matched"));
});

test("handles side-effect, dynamic and CommonJS imports", () => {
  const files = [
    { path: "src/main.js", content: 'import "./setup.js";\nconst lazy = import("./lazy.js");\nconst util = require("./util.cjs");' },
    { path: "src/setup.js", content: "export {};" },
    { path: "src/lazy.js", content: "export default 1;" },
    { path: "src/util.cjs", content: "module.exports = {};" },
  ];
  const graph = analyzeProjectDependencies(files);
  const dependencies = graph.dependencies.get("src/main.js");
  assert.ok(dependencies.has("src/setup.js"));
  assert.ok(dependencies.has("src/lazy.js"));
  assert.ok(dependencies.has("src/util.cjs"));
});
