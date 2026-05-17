/**
 * build/main.js — orchestrates a clean build of the site.
 *
 * Steps:
 *   1. Remove and recreate dist/.
 *   2. Copy everything under src/ into dist/, except build inputs that
 *      aren't directly servable (see EXCLUDE_SUFFIXES below).
 *   3. Generate dist/spec.html from src/spec.md via build/spec.js.
 *   4. Generate dist/changelog.html from git history via build/changelog.js.
 *   5. Rasterize favicon / OG-image PNGs and ICO via build/assets.js.
 */

import { cpSync, rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";
import { buildSpec } from "./spec.js";
import { buildChangelog } from "./changelog.js";
import { buildAssets } from "./assets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SRC = resolve(root, "src");
const DIST = resolve(root, "dist");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Copy src/ → dist/, skipping build inputs that aren't directly servable:
//   .md            — Markdown sources consumed by build/spec.js
//   .template.html — HTML templates consumed by build/spec.js
//   .source.svg    — SVG sources rasterized by build/assets.js
//                    (e.g. og.source.svg → dist/og-image.png)
const EXCLUDE_SUFFIXES = [".md", ".template.html", ".source.svg"];

cpSync(SRC, DIST, {
  recursive: true,
  filter: (source) => {
    const rel = relative(SRC, source);
    if (rel === "" || rel.startsWith("..")) return true;
    return !EXCLUDE_SUFFIXES.some((suffix) => rel.endsWith(suffix));
  },
});

console.log("✓ copied src/ → dist/");

buildSpec();
buildChangelog();
await buildAssets();
