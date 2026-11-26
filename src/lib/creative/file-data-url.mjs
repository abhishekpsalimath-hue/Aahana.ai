export function readFileAsDataUrl(file, { FileReaderCtor = globalThis.FileReader } = {}) {
  if (!file || typeof file.arrayBuffer !== "function" || typeof FileReaderCtor !== "function") {
    return Promise.reject(new TypeError("A supported browser file is required."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReaderCtor();
    reader.onload = () => {
      if (typeof reader.result === "string" && /^data:image\/(?:png|jpeg|webp);base64,/.test(reader.result)) {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read the selected reference image."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the selected reference image."));
    try {
      reader.readAsDataURL(file);
    } catch {
      reject(new Error("Could not read the selected reference image."));
    }
  });
}
