import { selectRelevantProjectFiles } from "../learning/project-source-policy.mjs";

const SOURCE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json"];
const SOURCE_SUFFIXES = ["", ...SOURCE_EXTENSIONS, ...SOURCE_EXTENSIONS.map((extension) => "/index" + extension)];

function normalizePath(value) {
  const parts = [];
  for (const part of String(value || "").replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length) parts.pop();
      else return null;
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function stripComments(source) {
  return String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

function collectSpecifiers(source) {
  const text = stripComments(source);
  const patterns = [
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function resolveLocalImport(importer, specifier, knownPaths) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;
  const base = specifier.startsWith("/")
    ? normalizePath(specifier.slice(1))
    : normalizePath(importer.split("/").slice(0, -1).concat(specifier.split("/")).join("/"));
  if (!base) return null;
  for (const suffix of SOURCE_SUFFIXES) {
    const candidate = base + suffix;
    if (knownPaths.has(candidate)) return candidate;
  }
  return null;
}

function readAliasConfig(byPath) {
  const configPath = byPath.has("tsconfig.json") ? "tsconfig.json"
    : byPath.has("jsconfig.json") ? "jsconfig.json" : null;
  if (!configPath) return { configPath: null, baseUrl: "", paths: [] };
  try {
    const config = JSON.parse(byPath.get(configPath).content);
    const options = config?.compilerOptions || {};
    const configDir = configPath.includes("/") ? configPath.slice(0, configPath.lastIndexOf("/")) : "";
    const baseUrl = typeof options.baseUrl === "string"
      ? normalizePath([configDir, options.baseUrl].filter(Boolean).join("/")) || ""
      : configDir;
    const paths = options.paths && typeof options.paths === "object" && !Array.isArray(options.paths)
      ? Object.entries(options.paths)
          .filter(([pattern, targets]) => typeof pattern === "string" && Array.isArray(targets) &&
            targets.length > 0 && targets.every((target) => typeof target === "string"))
          .map(([pattern, targets]) => ({ pattern, targets, wildcard: pattern.indexOf("*") }))
          .sort((a, b) => {
            const prefixA = a.wildcard < 0 ? a.pattern.length : a.wildcard;
            const prefixB = b.wildcard < 0 ? b.pattern.length : b.wildcard;
            return prefixB - prefixA;
          })
      : [];
    return { configPath, baseUrl, paths };
  } catch {
    return { configPath, baseUrl: "", paths: [], invalid: true };
  }
}

function resolveAliasImport(specifier, aliasConfig, knownPaths) {
  for (const mapping of aliasConfig.paths) {
    let capture = null;
    if (mapping.wildcard < 0) {
      if (specifier !== mapping.pattern) continue;
    } else {
      const prefix = mapping.pattern.slice(0, mapping.wildcard);
      const suffix = mapping.pattern.slice(mapping.wildcard + 1);
      if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix) ||
          specifier.length < prefix.length + suffix.length) continue;
      capture = specifier.slice(prefix.length, specifier.length - suffix.length);
    }
    for (const target of mapping.targets) {
      const substituted = capture === null ? target : target.replace("*", capture);
      const base = normalizePath([aliasConfig.baseUrl, substituted].filter(Boolean).join("/"));
      if (!base) continue;
      for (const suffix of SOURCE_SUFFIXES) {
        const candidate = base + suffix;
        if (knownPaths.has(candidate)) return candidate;
      }
    }
  }
  if (aliasConfig.baseUrl) {
    const base = normalizePath([aliasConfig.baseUrl, specifier].join("/"));
    if (base) {
      for (const suffix of SOURCE_SUFFIXES) {
        const candidate = base + suffix;
        if (knownPaths.has(candidate)) return candidate;
      }
    }
  }
  return null;
}

function packageName(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Builds a conservative static import graph from the supplied source snapshot.
 * It never executes source code and does not resolve package aliases by guessing.
 */
export function analyzeProjectDependencies(files) {
  const records = Array.isArray(files) ? files : [];
  const byPath = new Map();
  for (const file of records) {
    const path = normalizePath(file?.path || file?.original_filename);
    if (path && typeof file?.content === "string" && !byPath.has(path)) byPath.set(path, file);
  }
  const knownPaths = new Set(byPath.keys());
  const aliasConfig = readAliasConfig(byPath);
  const dependencies = new Map();
  const dependents = new Map();
  const external = [];
  const unresolved = [];

  for (const [path, file] of byPath) {
    const local = new Set();
    for (const specifier of collectSpecifiers(file.content)) {
      const resolved = resolveLocalImport(path, specifier, knownPaths) ||
        resolveAliasImport(specifier, aliasConfig, knownPaths);
      if (resolved) {
        local.add(resolved);
        if (!dependents.has(resolved)) dependents.set(resolved, new Set());
        dependents.get(resolved).add(path);
      } else if (specifier.startsWith(".") || specifier.startsWith("/") ||
          specifier.startsWith("@/") || specifier.startsWith("~/") ||
          (aliasConfig.invalid && !specifier.startsWith("@"))) {
        unresolved.push({ from: path, specifier });
      } else {
        const name = packageName(specifier);
        if (name) external.push({ from: path, specifier, packageName: name });
        else unresolved.push({ from: path, specifier });
      }
    }
    dependencies.set(path, local);
  }

  return Object.freeze({
    fileCount: byPath.size,
    aliasConfig: Object.freeze({
      configPath: aliasConfig.configPath,
      baseUrl: aliasConfig.baseUrl,
      pathMappings: aliasConfig.paths.length,
      invalid: Boolean(aliasConfig.invalid),
    }),
    dependencies,
    dependents,
    external: Object.freeze(external),
    unresolved: Object.freeze(unresolved),
  });
}

/**
 * Starts from the strongest prompt matches, then adds connected imports and
 * reverse dependents so visible callers/contracts travel together.
 */
export function selectProjectFilesWithDependencies(prompt, files, limit = 8, seedLimit = 4) {
  const records = Array.isArray(files) ? files : [];
  const graph = analyzeProjectDependencies(records);
  const safeLimit = Math.max(0, Math.min(8, Number.isInteger(limit) ? limit : 8));
  const safeSeedLimit = Math.max(0, Math.min(safeLimit, Number.isInteger(seedLimit) ? seedLimit : 4));
  const seeds = selectRelevantProjectFiles(prompt, records, safeSeedLimit);
  const selected = new Set(seeds.map((file) => normalizePath(file?.path || file?.original_filename)).filter(Boolean));
  const distance = new Map([...selected].map((path) => [path, 0]));
  const queue = [...selected];

  while (queue.length && selected.size < safeLimit) {
    const current = queue.shift();
    const neighbors = [
      ...(graph.dependencies.get(current) || []),
      ...(graph.dependents.get(current) || []),
    ];
    for (const neighbor of neighbors) {
      if (!distance.has(neighbor)) {
        distance.set(neighbor, distance.get(current) + 1);
        selected.add(neighbor);
        queue.push(neighbor);
        if (selected.size >= safeLimit) break;
      }
    }
  }

  const orderedPaths = [...selected].sort((a, b) =>
    (distance.get(a) ?? 99) - (distance.get(b) ?? 99) || a.localeCompare(b)
  );
  const fileByPath = new Map(records.map((file) => [normalizePath(file?.path || file?.original_filename), file]));
  const relationships = [];
  for (const from of orderedPaths) {
    for (const to of graph.dependencies.get(from) || []) {
      if (selected.has(to)) relationships.push({ from, to, kind: "imports" });
    }
  }
  return Object.freeze({
    files: orderedPaths.map((path) => fileByPath.get(path)).filter(Boolean),
    seedPaths: Object.freeze([...seeds.map((file) => normalizePath(file?.path || file?.original_filename)).filter(Boolean)]),
    relationships: Object.freeze(relationships),
    external: graph.external.filter((item) => selected.has(item.from)),
    unresolved: graph.unresolved.filter((item) => selected.has(item.from)),
  });
}

