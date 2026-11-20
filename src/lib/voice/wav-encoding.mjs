const RIFF = [0x52, 0x49, 0x46, 0x46];
const WAVE = [0x57, 0x41, 0x56, 0x45];
const MAX_WAV_BYTES = 15 * 1024 * 1024;

export function encodePcm16Wav(chunks, sampleRate) {
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error("Audio recording is empty.");
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new Error("Audio sample rate is invalid.");
  }
  let sampleCount = 0;
  for (const chunk of chunks) {
    if (!(chunk instanceof Float32Array)) throw new Error("Audio sample data is invalid.");
    for (let index = 0; index < chunk.length; index += 1) {
      if (!Number.isFinite(chunk[index])) throw new Error("Audio samples must contain only finite values.");
    }
    sampleCount += chunk.length;
  }
  const dataBytes = sampleCount * 2;
  const totalBytes = 44 + dataBytes;
  if (!sampleCount || totalBytes > MAX_WAV_BYTES) throw new Error("Audio recording exceeds the 15 MB limit.");
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  const writeText = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, totalBytes - 8, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

export function isPcm16Wav(value) {
  if (!(value instanceof ArrayBuffer) || value.byteLength < 44) return false;
  const bytes = new Uint8Array(value, 0, 44);
  return RIFF.every((byte, index) => bytes[index] === byte)
    && WAVE.every((byte, index) => bytes[index + 8] === byte)
    && bytes[12] === 0x66 && bytes[13] === 0x6d && bytes[14] === 0x74 && bytes[15] === 0x20
    && bytes[36] === 0x64 && bytes[37] === 0x61 && bytes[38] === 0x74 && bytes[39] === 0x61;
}
