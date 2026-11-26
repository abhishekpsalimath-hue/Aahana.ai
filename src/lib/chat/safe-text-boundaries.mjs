/**
 * Keep the newest text within a UTF-16 code-unit budget without starting
 * halfway through a supplementary Unicode character.
 */
export function takeLastWithinUtf16Limit(value, maxCodeUnits) {
  if (typeof value !== "string" || !Number.isFinite(maxCodeUnits)) return "";
  const limit = Math.max(0, Math.floor(maxCodeUnits));
  if (limit === 0 || value.length === 0) return "";
  if (value.length <= limit) return value;

  let start = value.length - limit;
  const firstIncluded = value.charCodeAt(start);
  const previous = value.charCodeAt(start - 1);
  if (firstIncluded >= 0xdc00 && firstIncluded <= 0xdfff &&
      previous >= 0xd800 && previous <= 0xdbff) {
    start += 1;
  }
  return value.slice(start);
}
