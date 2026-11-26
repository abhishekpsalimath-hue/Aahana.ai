import test from "node:test";
import assert from "node:assert/strict";
import { readFileAsDataUrl } from "./file-data-url.mjs";

function readerWith(result, error = false) {
  return class FakeFileReader {
    result = null;
    onload = null;
    onerror = null;
    readAsDataURL(file) {
      assert.equal(file.name, "reference.png");
      if (error) { this.onerror?.(); return; }
      this.result = result;
      this.onload?.();
    }
  };
}

test("reads supported reference images as data URLs", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "reference.png", { type: "image/png" });
  const result = await readFileAsDataUrl(file, { FileReaderCtor: readerWith("data:image/png;base64,AQID") });
  assert.equal(result, "data:image/png;base64,AQID");
});

test("rejects unsupported, malformed, and failed reads", async () => {
  const file = new File(["x"], "reference.png", { type: "image/png" });
  await assert.rejects(readFileAsDataUrl(file, { FileReaderCtor: readerWith("data:image/gif;base64,AA==") }), /Could not read/);
  await assert.rejects(readFileAsDataUrl(file, { FileReaderCtor: readerWith(null, true) }), /Could not read/);
  await assert.rejects(readFileAsDataUrl(null), /supported browser file/);
});
