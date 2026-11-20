export function getPreviewCommand(manifest) {
  const script = manifest?.scripts?.dev;
  if (typeof script !== "string" || !script.trim() || script.length > 500) {
    throw new Error("Add a dev script to package.json before opening a live preview.");
  }
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  if (typeof dependencies.next === "string") {
    return Object.freeze({ command: "npm", args: Object.freeze(["run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]) });
  }
  if (typeof dependencies.vite === "string") {
    return Object.freeze({ command: "npm", args: Object.freeze(["run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]) });
  }
  throw new Error("Live preview currently supports Next.js and Vite projects with a dev script.");
}
