const DB_NAME = "aahana-studio-assets";
const STORE_NAME = "assets";
const DB_VERSION = 1;
const MAX_ASSET_BYTES = 250 * 1024 * 1024;
const MIME_BY_KIND = {
  image: new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]),
  audio: new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"]),
  video: new Set(["video/mp4", "video/webm", "video/ogg"]),
  "model-3d": new Set(["model/gltf-binary", "model/gltf+json", "application/octet-stream"]),
  font: new Set(["font/woff", "font/woff2", "font/ttf", "application/font-woff", "application/octet-stream"]),
  other: new Set(["application/pdf", "text/plain"]),
};

function requireBrowserDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("Aahana Asset Library requires a browser with IndexedDB support.");
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the Aahana Asset Library."));
    request.onblocked = () => reject(new Error("Aahana Asset Library is busy in another tab. Close older Aahana tabs and retry."));
  });
}

function inferKind(file, requestedKind) {
  if (requestedKind && Object.hasOwn(MIME_BY_KIND, requestedKind)) return requestedKind;
  const type = String(file.type || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type === "model/gltf-binary" || type === "model/gltf+json") return "model-3d";
  if (type.startsWith("font/")) return "font";
  return "other";
}

function transaction(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error || new Error("Asset Library transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("Asset Library transaction was aborted."));
  });
}

export async function saveStudioAsset(file, { id, kind } = {}) {
  if (typeof File === "undefined" || !(file instanceof File)) throw new TypeError("Choose a valid file to add to the Asset Library.");
  if (file.size <= 0 || file.size > MAX_ASSET_BYTES) throw new RangeError("Assets must be between 1 byte and 250 MB.");
  const assetKind = inferKind(file, kind);
  const mimeType = String(file.type || "application/octet-stream").toLowerCase();
  if (!MIME_BY_KIND[assetKind].has(mimeType)) throw new TypeError("This file type is not supported for the selected asset category.");
  const assetId = id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `asset-${Date.now()}-${Math.floor(Math.random() * 1000000)}`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(assetId)) throw new TypeError("Invalid asset identifier.");
  const metadata = {
    id: assetId,
    kind: assetKind,
    name: String(file.name || "Untitled asset").slice(0, 180),
    mimeType,
    size: file.size,
    storageKey: `idb:${assetId}`,
    createdAt: new Date().toISOString(),
  };
  const database = await requireBrowserDatabase();
  try {
    await transaction(database, "readwrite", (store) => store.put({ ...metadata, blob: file }));
  } finally {
    database.close();
  }
  return metadata;
}

export async function getStudioAsset(assetId) {
  const database = await requireBrowserDatabase();
  try {
    const record = await transaction(database, "readonly", (store) => store.get(assetId));
    if (!record) return null;
    return { metadata: {
      id: record.id, kind: record.kind, name: record.name, mimeType: record.mimeType,
      size: record.size, storageKey: record.storageKey, createdAt: record.createdAt,
    }, blob: record.blob };
  } finally {
    database.close();
  }
}

export async function listStudioAssets({ kind } = {}) {
  const database = await requireBrowserDatabase();
  try {
    const records = await transaction(database, "readonly", (store) => kind ? store.index("kind").getAll(kind) : store.getAll());
    return (records || []).map(({ blob, ...metadata }) => metadata).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    database.close();
  }
}

export async function deleteStudioAsset(assetId) {
  if (typeof assetId !== "string" || !assetId) return false;
  const database = await requireBrowserDatabase();
  try {
    await transaction(database, "readwrite", (store) => store.delete(assetId));
    return true;
  } finally {
    database.close();
  }
}
