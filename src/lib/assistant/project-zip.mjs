import { getSafeCodeFilePath } from "./code-file-policy.mjs";

const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function write16(view, offset, value) { view.setUint16(offset, value, true); }
function write32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

export function extractProjectFiles(source) {
  const files = [];
  const seen = new Set();
  const fence = String.fromCharCode(96).repeat(3);
  const pattern = new RegExp(fence + "([^\\n]*)\\n([\\s\\S]*?)" + fence, "g");
  let match;
  while ((match = pattern.exec(String(source || ""))) !== null) {
    const path = getSafeCodeFilePath(match[1].trim());
    if (!path || seen.has(path)) continue;
    seen.add(path);
    files.push({ path, content: match[2].replace(/\n$/, "") });
  }
  return files;
}

export function createStoredZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("At least one project file is required.");
  const files = [];
  const seen = new Set();
  for (const entry of entries) {
    const path = getSafeCodeFilePath("code " + String(entry?.path || ""));
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const name = encoder.encode(path);
    const data = encoder.encode(String(entry?.content ?? ""));
    if (name.length > 0xffff || data.length > 0xffffffff) throw new Error("A project file is too large to package.");
    files.push({ name, data, crc: crc32(data) });
  }
  if (!files.length) throw new Error("No safe project files were found.");

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const file of files) {
    const local = new Uint8Array(30 + file.name.length);
    const lv = new DataView(local.buffer);
    write32(lv, 0, 0x04034b50); write16(lv, 4, 20); write16(lv, 6, 0x0800);
    write16(lv, 8, 0); write16(lv, 10, 0); write16(lv, 12, 0);
    write32(lv, 14, file.crc); write32(lv, 18, file.data.length); write32(lv, 22, file.data.length);
    write16(lv, 26, file.name.length); write16(lv, 28, 0); local.set(file.name, 30);
    localParts.push(local, file.data);

    const central = new Uint8Array(46 + file.name.length);
    const cv = new DataView(central.buffer);
    write32(cv, 0, 0x02014b50); write16(cv, 4, 20); write16(cv, 6, 20);
    write16(cv, 8, 0x0800); write16(cv, 10, 0); write16(cv, 12, 0); write16(cv, 14, 0);
    write32(cv, 16, file.crc); write32(cv, 20, file.data.length); write32(cv, 24, file.data.length);
    write16(cv, 28, file.name.length); write16(cv, 30, 0); write16(cv, 32, 0);
    write16(cv, 34, 0); write16(cv, 36, 0); write32(cv, 38, 0); write32(cv, 42, localOffset);
    central.set(file.name, 46); centralParts.push(central);
    localOffset += local.length + file.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  write32(ev, 0, 0x06054b50); write16(ev, 4, 0); write16(ev, 6, 0);
  write16(ev, 8, files.length); write16(ev, 10, files.length);
  write32(ev, 12, centralSize); write32(ev, 16, localOffset); write16(ev, 20, 0);

  const archive = new Uint8Array(localOffset + centralSize + end.length);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, end]) { archive.set(part, offset); offset += part.length; }
  return archive;
}
