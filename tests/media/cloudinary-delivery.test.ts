import assert from "node:assert/strict";
import test from "node:test";

import {
  cloudinarySrcSet,
  cloudinaryWidthUrl,
  isCloudinaryMediaUrl,
  optimizeCloudinaryUrl,
  shouldBypassNextImageOptimizer,
} from "@/lib/cloudinary-delivery";

const raw =
  "https://res.cloudinary.com/demo/image/upload/v1/spark/cars/dashing.jpg";

test("Cloudinary listing images skip the Next optimizer hop", () => {
  assert.equal(isCloudinaryMediaUrl(raw), true);
  assert.equal(shouldBypassNextImageOptimizer(raw), true);
  assert.equal(shouldBypassNextImageOptimizer("/brand/logo-emblem.png"), false);
});

test("gallery stage keeps best quality and a retina-ready width", () => {
  const url = optimizeCloudinaryUrl(raw, "galleryStage");
  assert.match(url, /q_auto:best/);
  assert.match(url, /w_1920/);
  assert.equal(url.includes("q_auto,"), false);
});

test("responsive srcset offers multiple high-fidelity widths", () => {
  const { src, srcSet } = cloudinarySrcSet(raw, "galleryStage");
  assert.match(src, /w_1920/);
  assert.ok(srcSet);
  assert.match(srcSet!, /960w/);
  assert.match(srcSet!, /2560w/);
  assert.equal(srcSet!.includes("q_auto:best"), true);
});

test("already-transformed Cloudinary URLs are left intact", () => {
  const existing = "https://res.cloudinary.com/demo/image/upload/c_limit,w_400/v1/spark/cars/dashing.jpg";
  assert.equal(optimizeCloudinaryUrl(existing, "galleryStage"), existing);
  assert.equal(cloudinaryWidthUrl(existing, 1920), null);
});

test("non-Cloudinary URLs pass through unchanged", () => {
  const local = "/uploads/car.jpg";
  assert.equal(optimizeCloudinaryUrl(local, "galleryStage"), local);
  assert.deepEqual(cloudinarySrcSet(local, "galleryStage"), { src: local });
});
