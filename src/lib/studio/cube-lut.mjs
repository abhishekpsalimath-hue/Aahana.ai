const MAX_LUT_SIZE = 64;
const MIN_LUT_SIZE = 2;

export function parseCubeLut(source) {
  if (typeof source !== "string" || source.length > 2_000_000) return null;
  let size = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const values = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const directive = parts[0].toUpperCase();
    if (["TITLE", "LUT_1D_SIZE"].includes(directive)) continue;
    if (directive === "LUT_3D_SIZE") {
      if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return null;
      size = Number(parts[1]);
      if (size < MIN_LUT_SIZE || size > MAX_LUT_SIZE) return null;
      continue;
    }
    if (directive === "DOMAIN_MIN" || directive === "DOMAIN_MAX") {
      if (parts.length !== 4) return null;
      const tuple = parts.slice(1).map(Number);
      if (tuple.some((value) => !Number.isFinite(value))) return null;
      if (directive === "DOMAIN_MIN") domainMin = tuple;
      else domainMax = tuple;
      continue;
    }
    if (/^[A-Z_]+$/.test(directive)) return null;
    if (parts.length !== 3) return null;
    const rgb = parts.map(Number);
    if (rgb.some((value) => !Number.isFinite(value) || value < -4 || value > 4)) return null;
    values.push(rgb);
    if (values.length > MAX_LUT_SIZE ** 3) return null;
  }
  if (!size || values.length !== size ** 3 || domainMin.some((value, i) => domainMax[i] <= value)) return null;
  return Object.freeze({ size, domainMin, domainMax, values });
}

export function applyCubeLutToImageData(imageData, lut) {
  if (!imageData?.data || !lut?.values || !Number.isInteger(lut.size) || lut.values.length !== lut.size ** 3) {
    throw new TypeError("A valid image buffer and 3D LUT are required.");
  }
  const { data } = imageData;
  const { size, domainMin, domainMax, values } = lut;
  const max = size - 1;
  const sample = (r, g, b) => values[(b * size + g) * size + r];
  const mix = (a, b, t) => a + (b - a) * t;
  for (let offset = 0; offset < data.length; offset += 4) {
    const input = [data[offset] / 255, data[offset + 1] / 255, data[offset + 2] / 255]
      .map((value, i) => Math.max(0, Math.min(1, (value - domainMin[i]) / (domainMax[i] - domainMin[i]))) * max);
    const lo = input.map(Math.floor);
    const hi = lo.map((value) => Math.min(max, value + 1));
    const t = input.map((value, i) => value - lo[i]);
    const c000 = sample(lo[0], lo[1], lo[2]);
    const c100 = sample(hi[0], lo[1], lo[2]);
    const c010 = sample(lo[0], hi[1], lo[2]);
    const c110 = sample(hi[0], hi[1], lo[2]);
    const c001 = sample(lo[0], lo[1], hi[2]);
    const c101 = sample(hi[0], lo[1], hi[2]);
    const c011 = sample(lo[0], hi[1], hi[2]);
    const c111 = sample(hi[0], hi[1], hi[2]);
    for (let channel = 0; channel < 3; channel += 1) {
      const low = mix(mix(c000[channel], c100[channel], t[0]), mix(c010[channel], c110[channel], t[0]), t[1]);
      const high = mix(mix(c001[channel], c101[channel], t[0]), mix(c011[channel], c111[channel], t[0]), t[1]);
      data[offset + channel] = Math.round(Math.max(0, Math.min(1, mix(low, high, t[2]))) * 255);
    }
  }
  return imageData;
}
