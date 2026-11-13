#!/usr/bin/env node
// Converts raw screenshots into the WebP files the site serves.
//
//   npm install --prefix _tools               # once, installs sharp
//   node _tools/optimize-screenshots.mjs      # converts everything in _screenshots/
//
// Input:  _screenshots/**/*.{png,jpg,jpeg,webp} (gitignored, keep the originals there)
// Output: assets/images/screenshots/**/*.webp, same relative path, scaled down to --width
//
// Name screenshots <name>-light.png and <name>-dark.png; the script prints the front matter
// for both variants (see _layouts/home.html for the `screenshots` format).
//
// Options: --width <px> (default 1600), --quality <1-100> (default 82),
//          or pass files/folders inside _screenshots/ to convert only those.

import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. Run: npm install --prefix _tools");
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_DIR = path.join(ROOT, "_screenshots");
const OUTPUT_DIR = path.join(ROOT, "assets", "images", "screenshots");
const EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const args = process.argv.slice(2);
const options = { width: 1600, quality: 82 };
const targets = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--width" || arg === "--quality") {
    const value = Number(args[++i]);
    if (!Number.isInteger(value) || value <= 0) {
      console.error(`${arg} needs a positive whole number`);
      process.exit(1);
    }
    options[arg.slice(2)] = value;
  } else if (arg === "--help" || arg === "-h") {
    console.log("Usage: node _tools/optimize-screenshots.mjs [--width 1600] [--quality 82] [paths in _screenshots/]");
    process.exit(0);
  } else {
    targets.push(path.resolve(arg));
  }
}

/** @returns {Promise<string[]>} all image files below a file or folder */
async function collect(target) {
  const info = await stat(target).catch(() => null);
  if (!info) {
    console.error(`Not found: ${path.relative(ROOT, target) || target}`);
    process.exit(1);
  }
  if (info.isFile()) {
    return EXTENSIONS.has(path.extname(target).toLowerCase()) ? [target] : [];
  }
  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => collect(path.join(target, entry.name))));
  return nested.flat();
}

const sources = (await Promise.all((targets.length ? targets : [INPUT_DIR]).map(collect))).flat().sort();
const outside = sources.filter((file) => path.relative(INPUT_DIR, file).startsWith(".."));
if (outside.length) {
  console.error(`Put screenshots inside _screenshots/ first:\n  ${outside.join("\n  ")}`);
  process.exit(1);
}
if (!sources.length) {
  console.log("No screenshots found in _screenshots/. Add PNG files there and run this again.");
  process.exit(0);
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const results = [];
for (const source of sources) {
  const relative = path.relative(INPUT_DIR, source);
  const target = path.join(OUTPUT_DIR, relative.replace(/\.[^.]+$/, ".webp"));
  await mkdir(path.dirname(target), { recursive: true });
  const before = (await stat(source)).size;
  const info = await sharp(source)
    .resize({ width: options.width, withoutEnlargement: true })
    .webp({ quality: options.quality, effort: 6 })
    .toFile(target);
  const url = "/" + path.relative(ROOT, target).split(path.sep).join("/");
  results.push({ url, width: info.width, height: info.height });
  console.log(`${relative.split(path.sep).join("/")} -> ${url}  ${info.width}x${info.height}  ${kb(before)} -> ${kb(info.size)}`);
}

// Front matter for the home layout, pairing <name>-light and <name>-dark
const groups = new Map();
for (const result of results) {
  const match = result.url.match(/^(.*)-(light|dark)\.webp$/);
  const key = match ? match[1] : result.url;
  const group = groups.get(key) ?? { ...result };
  group[match ? match[2] : "dark"] = result.url;
  groups.set(key, group);
}
console.log("\nFront matter (screenshots in _layouts/home.html; add alt text):\n");
for (const group of groups.values()) {
  console.log(`  - dark: ${group.dark ?? group.light}`);
  if (group.light && group.dark) console.log(`    light: ${group.light}`);
  console.log(`    alt: TODO\n    width: ${group.width}\n    height: ${group.height}`);
}
