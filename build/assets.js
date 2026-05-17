/**
 * build/assets.js — rasterizes SVG sources into dist/ at build time.
 *
 * Inputs (src/, version-controlled):
 *   - favicon.svg     editable single source of truth for every icon
 *   - og.source.svg   editable source for the 1200×630 social preview
 *   - fonts/JetBrainsMono-{Regular,Bold}.woff2
 *
 * Outputs (dist/, regenerated on every build):
 *   - favicon.ico         multi-size 16/32/48 (rounded — matches favicon.svg)
 *   - apple-touch-icon.png 180×180 square (iOS rounds it itself)
 *   - icon-192.png        192×192 square (Android / PWA manifest)
 *   - icon-512.png        512×512 square (Android / PWA manifest)
 *   - og-image.png        1200×630 social preview
 *
 * The square (non-rounded) variants are produced by swapping rx="6" → rx="0"
 * in favicon.svg before rendering, so iOS / Android can apply their own
 * corner masks cleanly without leaving a white halo.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import wawoff2 from "wawoff2";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SRC = resolve(root, "src");
const DIST = resolve(root, "dist");
const BUILD_TMP = resolve(root, "node_modules/.cache/gitmomentum-fonts");

// resvg-js v2.x ships an older fontdb that can't read woff2 directly, so we
// decompress the site's woff2 files into TTF buffers and stash them under
// node_modules/.cache during the build. The site itself keeps serving the
// woff2 — these TTFs are purely for the rasterizer.
let ttfPaths = null;

async function ensureTtfFonts() {
  if (ttfPaths) return ttfPaths;
  mkdirSync(BUILD_TMP, { recursive: true });
  ttfPaths = [];
  for (const [woff2, ttf] of [
    ["JetBrainsMono-Regular.woff2", "JetBrainsMono-Regular.ttf"],
    ["JetBrainsMono-Bold.woff2", "JetBrainsMono-Bold.ttf"],
  ]) {
    const ttfPath = resolve(BUILD_TMP, ttf);
    const ttfBuf = await wawoff2.decompress(readFileSync(resolve(SRC, "fonts", woff2)));
    writeFileSync(ttfPath, ttfBuf);
    ttfPaths.push(ttfPath);
  }
  return ttfPaths;
}

function renderSvgToPng(svg, width, fontFiles) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
    font: {
      loadSystemFonts: false,
      fontFiles,
      defaultFontFamily: "JetBrains Mono",
    },
    shapeRendering: 2,
    textRendering: 2,
    imageRendering: 0,
  });
  return resvg.render().asPng();
}

export async function buildAssets() {
  const fontFiles = await ensureTtfFonts();
  const faviconSvg = readFileSync(resolve(SRC, "favicon.svg"), "utf8");
  // Apple touch + PWA icons are full squares so the OS can apply its own
  // corner mask — render them from a no-radius variant of the same SVG.
  const squareSvg = faviconSvg.replace(/\brx="6"\s+ry="6"/g, 'rx="0" ry="0"');

  writeFileSync(resolve(DIST, "apple-touch-icon.png"), renderSvgToPng(squareSvg, 180, fontFiles));
  writeFileSync(resolve(DIST, "icon-192.png"), renderSvgToPng(squareSvg, 192, fontFiles));
  writeFileSync(resolve(DIST, "icon-512.png"), renderSvgToPng(squareSvg, 512, fontFiles));

  const ico16 = renderSvgToPng(faviconSvg, 16, fontFiles);
  const ico32 = renderSvgToPng(faviconSvg, 32, fontFiles);
  const ico48 = renderSvgToPng(faviconSvg, 48, fontFiles);
  const icoBuffer = await pngToIco([ico16, ico32, ico48]);
  writeFileSync(resolve(DIST, "favicon.ico"), icoBuffer);

  console.log("✓ dist/favicon.ico + apple-touch-icon.png + icon-192.png + icon-512.png");

  const ogSvg = readFileSync(resolve(SRC, "og.source.svg"), "utf8");
  const ogPng = renderSvgToPng(ogSvg, 1200, fontFiles);
  writeFileSync(resolve(DIST, "og-image.png"), ogPng);

  const kb = (ogPng.length / 1024).toFixed(1);
  console.log(`✓ dist/og-image.png (${kb} KB, 1200x630)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildAssets();
}
