export function hasPcm16MonoWavHeader(header, totalBytes) {
  if (!(header instanceof Uint8Array) || header.byteLength < 44) return false;
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 46 || totalBytes > 15 * 1024 * 1024) return false;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const isTag = (offset, tag) => tag.split("").every((character, index) => header[offset + index] === character.charCodeAt(0));
  const sampleRate = view.getUint32(24, true);
  const dataBytes = view.getUint32(40, true);
  return isTag(0, "RIFF")
    && isTag(8, "WAVE")
    && isTag(12, "fmt ")
    && view.getUint32(4, true) === totalBytes - 8
    && view.getUint32(16, true) === 16
    && view.getUint16(20, true) === 1
    && view.getUint16(22, true) === 1
    && Number.isInteger(sampleRate) && sampleRate >= 8000 && sampleRate <= 192000
    && view.getUint32(28, true) === sampleRate * 2
    && view.getUint16(32, true) === 2
    && view.getUint16(34, true) === 16
    && isTag(36, "data")
    && dataBytes > 0
    && dataBytes % 2 === 0
    && dataBytes === totalBytes - 44;
}