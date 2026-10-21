#!/usr/bin/env node
/**
 * Crop the official circular emblem tightly and emit homescreen / splash assets
 * so iOS and Android show the badge, text, and frame at readable size.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "public/brand/logo-emblem.png");
const BG = { r: 0, g: 0, b: 0, alpha: 1 };

const SPLASHES = [
  { w: 1290, h: 2796, name: "iphone-14-pro-max" },
  { w: 1179, h: 2556, name: "iphone-15-pro" },
  { w: 1170, h: 2532, name: "iphone-14" },
  { w: 1284, h: 2778, name: "iphone-14-plus" },
  { w: 1125, h: 2436, name: "iphone-x" },
  { w: 1242, h: 2688, name: "iphone-xs-max" },
  { w: 828, h: 1792, name: "iphone-xr" },
  { w: 750, h: 1334, name: "iphone-se" },
  { w: 1242, h: 2208, name: "iphone-8-plus" },
  { w: 2048, h: 2732, name: "ipad-12" },
  { w: 1668, h: 2388, name: "ipad-11" },
  { w: 1668, h: 2224, name: "ipad-10-5" },
  { w: 1640, h: 2360, name: "ipad-10-9" },
  { w: 1536, h: 2048, name: "ipad-9-7" },
];

async function findEmblemBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const threshold = 22;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i] + data[i + 1] + data[i + 2] > threshold * 3) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    throw new Error("Could not detect the official emblem in the source logo.");
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const side = Math.ceil(Math.max(maxX - minX, maxY - minY) * 1.04);
  const left = Math.max(0, Math.round(cx - side / 2));
  const top = Math.max(0, Math.round(cy - side / 2));
  const widthBox = Math.min(side, width - left);
  const heightBox = Math.min(side, height - top);
  return { left, top, width: widthBox, height: heightBox };
}

async function extractEmblem(box) {
  const square = Math.max(box.width, box.height);
  return sharp(SOURCE)
    .extract(box)
    .resize(square, square, { fit: "cover", background: BG })
    .png();
}

async function writeFilledIcon(emblem, size, dest, fill = 0.96) {
  const inner = Math.round(size * fill);
  const pad = Math.round((size - inner) / 2);
  const resized = emblem
    .clone()
    .resize(inner, inner, { fit: "contain", background: BG, kernel: sharp.kernel.lanczos3 });
  const badge = await (size <= 192 ? resized.sharpen({ sigma: 0.7 }) : resized).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: badge, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

async function writeSplash(emblemPng, w, h, dest) {
  const logoSize = Math.round(Math.min(w, h) * 0.72);
  const badge = await sharp(emblemPng)
    .resize(logoSize, logoSize, { fit: "contain", background: BG })
    .png()
    .toBuffer();
  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([{ input: badge, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

const box = await findEmblemBox(SOURCE);
console.log("emblem crop", box);
const emblem = await extractEmblem(box);
const splashDir = path.join(root, "public/splash");
fs.mkdirSync(splashDir, { recursive: true });

const emblemPng = path.join(splashDir, "emblem-square.png");
await emblem.clone().png({ compressionLevel: 9 }).toFile(emblemPng);

await writeFilledIcon(emblem, 180, path.join(root, "public/apple-touch-icon.png"), 0.97);
await writeFilledIcon(emblem, 167, path.join(root, "public/apple-touch-icon-167.png"), 0.97);
await writeFilledIcon(emblem, 192, path.join(root, "public/icon-192.png"), 0.97);
await writeFilledIcon(emblem, 512, path.join(root, "public/icon-512.png"), 0.97);
await writeFilledIcon(emblem, 1024, path.join(root, "public/icon-1024.png"), 0.97);
await writeFilledIcon(emblem, 192, path.join(root, "public/icon-192-maskable.png"), 0.8);
await writeFilledIcon(emblem, 512, path.join(root, "public/icon-512-maskable.png"), 0.8);

const emblemBuf = await fs.promises.readFile(emblemPng);
for (const s of SPLASHES) {
  const dest = path.join(splashDir, `${s.name}.png`);
  await writeSplash(emblemBuf, s.w, s.h, dest);
  console.log("splash", s.name, `${s.w}x${s.h}`);
}

console.log("homescreen icons generated");
