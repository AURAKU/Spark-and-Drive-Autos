import assert from "node:assert/strict";
import test from "node:test";

import {
  cloudinarySrcSet,
  cloudinaryWidthUrl,
  encodeCloudinarySrcSetUrl,
  forceCloudinaryJpegUrl,
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
  assert.equal(srcSet!.includes("c_limit,"), false, "raw commas inside a candidate break Safari srcset parsing");
  assert.match(srcSet!, /c_limit%2C/);
  assert.match(srcSet!, /, https:\/\//);
});

test("srcset candidate URLs percent-encode Cloudinary commas", () => {
  const href = "https://res.cloudinary.com/demo/image/upload/c_limit,w_480,q_auto:best,f_auto/v1/spark/cars/dashing.jpg";
  assert.equal(
    encodeCloudinarySrcSetUrl(href),
    "https://res.cloudinary.com/demo/image/upload/c_limit%2Cw_480%2Cq_auto:best%2Cf_auto/v1/spark/cars/dashing.jpg",
  );
});

test("JPEG force replaces f_auto for Safari decode fallback", () => {
  const auto = optimizeCloudinaryUrl(raw, "card");
  const jpg = forceCloudinaryJpegUrl(auto);
  assert.ok(jpg);
  assert.match(jpg!, /f_jpg/);
  assert.equal(jpg!.includes("f_auto"), false);
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
