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

function parseJsonConfig(source) {
  const input = String(source || "");
  let uncommented = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        uncommented += char;
      } else {
        uncommented += " ";
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        uncommented += "  ";
        index += 1;
      } else {
        uncommented += char === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (inString) {
      uncommented += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      uncommented += char;
    } else if (char === "/" && next === "/") {
      lineComment = true;
      uncommented += "  ";
      index += 1;
    } else if (char === "/" && next === "*") {
      blockComment = true;
      uncommented += "  ";
      index += 1;
    } else {
      uncommented += char;
    }
  }

  let json = "";
  inString = false;
  escaped = false;
  for (let index = 0; index < uncommented.length; index += 1) {
    const char = uncommented[index];
    if (inString) {
      json += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      json += char;
    } else if (char === ",") {
      let lookahead = index + 1;
      while (/\\s/.test(uncommented[lookahead] || "")) lookahead += 1;
      if (uncommented[lookahead] !== "}" && uncommented[lookahead] !== "]") json += char;
    } else {
      json += char;
    }
  }
  return JSON.parse(json);
}

function readAliasConfig(byPath) {
  const configPath = byPath.has("tsconfig.json") ? "tsconfig.json"
    : byPath.has("jsconfig.json") ? "jsconfig.json" : null;
  if (!configPath) return { configPath: null, baseUrl: "", paths: [] };
  try {
    const config = parseJsonConfig(byPath.get(configPath).content);
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

function collectExportedSymbols(source) {
  const text = stripComments(source);
  const symbols = new Map();
  const declarationPattern = /\bexport\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of text.matchAll(declarationPattern)) {
    symbols.set(match[2], match[1]);
  }
  const defaultFunction = /\bexport\s+default\s+(?:async\s+)?(?:function|class)\b/.test(text);
  if (/\bexport\s+default\s+(?!function\b|class\b)/.test(text) || defaultFunction) {
    symbols.set("default", "default");
  }
  for (const match of text.matchAll(/\bexport\s*\{([^}]+)\}(?:\s*from\s*["'][^"']+["'])?/g)) {
    for (const item of match[1].split(",")) {
      const parts = item.trim().split(/\s+as\s+/);
      const exported = (parts[1] || parts[0] || "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported)) symbols.set(exported, "re-export");
    }
  }
  return [...symbols].map(([name, kind]) => ({ name, kind }));
}

function collectImportedBindings(source) {
  const text = stripComments(source);
  const imports = [];
  const pattern = /\bimport\s+(?!\()([\s\S]{1,500}?)\s+from\s*["']([^"']+)["']/g;
  for (const match of text.matchAll(pattern)) {
    const clause = match[1].trim().replace(/^type\s+/, "");
    const bindings = [];
    const defaultMatch = clause.match(/^([A-Za-z_$][\w$]*)/);
    if (defaultMatch) bindings.push({ imported: "default", local: defaultMatch[1] });
    const namedMatch = clause.match(/\{([^}]+)\}/);
    if (namedMatch) {
      for (const item of namedMatch[1].split(",")) {
        const normalized = item.trim().replace(/^type\s+/, "");
        if (!normalized) continue;
        const parts = normalized.split(/\s+as\s+/);
        if (/^[A-Za-z_$][\w$]*$/.test(parts[0])) {
          bindings.push({ imported: parts[0], local: (parts[1] || parts[0]).trim() });
        }
      }
    }
    const namespaceMatch = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (namespaceMatch) bindings.push({ imported: "*", local: namespaceMatch[1] });
    imports.push({ specifier: match[2], bindings });
  }
  return imports;
}

/**
 * Reports visible module exports/import bindings and lightweight typed component
 * prop references. This is static text analysis, not a TypeScript/JSX parser.
 */
export function analyzeProjectContracts(files) {
  const records = Array.isArray(files) ? files : [];
  const byPath = new Map(records.map((file) => [normalizePath(file?.path || file?.original_filename), file]));
  const modules = [];
  const bindingRelationships = [];
  const unresolvedBindings = [];

  for (const [path, file] of byPath) {
    if (!path || typeof file?.content !== "string") continue;
    const exports = collectExportedSymbols(file.content);
    const imports = collectImportedBindings(file.content);
    const propTypes = [];
    const propPattern = /\\b(?:function|const|let)\\s+([A-Za-z_$][\\w$]*)[\\s\\S]{0,180}?\\(\\s*\\{[^}]*\\}\\s*:\\s*([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)/g;
    for (const match of stripComments(file.content).matchAll(propPattern)) {
      propTypes.push({ component: match[1], typeName: match[2] });
    }
    modules.push({ path, exports, imports, propTypes });

    for (const entry of imports) {
      const target = resolveLocalImport(path, entry.specifier, new Set(byPath.keys())) ||
        resolveAliasImport(entry.specifier, readAliasConfig(byPath), new Set(byPath.keys()));
      if (!target) continue;
      const targetExports = new Set((modules.find((item) => item.path === target)?.exports ||
        collectExportedSymbols(byPath.get(target)?.content || "")).map((item) => item.name));
      for (const binding of entry.bindings) {
        if (binding.imported === "*" || targetExports.has(binding.imported)) {
          bindingRelationships.push({ from: path, to: target, imported: binding.imported, local: binding.local, status: "matched" });
        } else {
          unresolvedBindings.push({ from: path, to: target, imported: binding.imported, local: binding.local });
        }
      }
    }
  }
  return Object.freeze({
    modules: Object.freeze(modules),
    bindingRelationships: Object.freeze(bindingRelationships),
    unresolvedBindings: Object.freeze(unresolvedBindings),
  });
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

