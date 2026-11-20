const WAV_RIFF = [0x52, 0x49, 0x46, 0x46];
const WAV_WAVE = [0x57, 0x41, 0x56, 0x45];

export function hasWavContainerHeader(value) {
  if (!(value instanceof Uint8Array) || value.byteLength < 12) return false;
  return WAV_RIFF.every((byte, index) => value[index] === byte)
    && WAV_WAVE.every((byte, index) => value[index + 8] === byte);
}
