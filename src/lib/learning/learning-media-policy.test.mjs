import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLearningImage, normalizeLearningVideo, normalizeLearningMedia } from "./learning-media-policy.mjs";

test("accepts trusted HTTPS educational images and bounds metadata", () => {
  const image = normalizeLearningImage({ url: "https://images.nasa.gov/image/earth.jpg", alt: "Earth from orbit", caption: "Earth", source: "NASA" });
  assert.equal(image.alt, "Earth from orbit");
  assert.equal(image.source, "NASA");
  assert.equal(normalizeLearningImage({ url: "http://images.nasa.gov/a.jpg", alt: "Earth" }), null);
  assert.equal(normalizeLearningImage({ url: "https://evil.example/a.jpg", alt: "Earth" }), null);
  assert.equal(normalizeLearningImage({ url: "https://images.nasa.gov/a.jpg", alt: "" }), null);
});

test("converts supported YouTube and Vimeo links to privacy-conscious embeds", () => {
  assert.equal(normalizeLearningVideo({ url: "https://youtu.be/abcdefghijk", title: "Orbit lesson" }).url, "https://www.youtube-nocookie.com/embed/abcdefghijk");
  assert.equal(normalizeLearningVideo({ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Orbit lesson" }).url, "https://www.youtube-nocookie.com/embed/abcdefghijk");
  assert.equal(normalizeLearningVideo({ url: "https://vimeo.com/1234567", title: "Lesson" }).url, "https://player.vimeo.com/video/1234567");
  assert.equal(normalizeLearningVideo({ url: "https://www.youtube.com.evil.example/watch?v=abcdefghijk", title: "Fake" }), null);
  assert.equal(normalizeLearningVideo({ url: "https://www.youtube.com/watch?v=short", title: "Bad ID" }), null);
  assert.equal(normalizeLearningVideo({ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "" }), null);
});

test("drops unsafe optional media without invalidating the learning scene", () => {
  const media = normalizeLearningMedia({ images: [{ url: "https://evil.example/x.png", alt: "unsafe" }], video: { url: "javascript:alert(1)", title: "unsafe" } });
  assert.equal(media, null);
  const safe = normalizeLearningMedia({ images: [{ url: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg", alt: "Example" }], video: { url: "https://vimeo.com/1234567", title: "Video" } });
  assert.equal(safe.images.length, 1);
  assert.equal(safe.video.url, "https://player.vimeo.com/video/1234567");
});
