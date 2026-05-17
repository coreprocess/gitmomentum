/**
 * build/spec.js — converts src/spec.md into dist/spec.html.
 *
 * Pipeline:
 *   1. Read src/spec.md and src/spec.template.html.
 *   2. Render Markdown with markdown-it; add heading IDs via markdown-it-anchor.
 *   3. Build a top-level table of contents from `##` headings.
 *   4. Prefix section numbers with `§` for visual continuity with the TOC.
 *   5. Substitute {{title}}, {{toc}}, {{content}} into the template.
 *   6. Write dist/spec.html.
 *
 * Designed to be both imported (`buildSpec()`) and runnable directly
 * (`node build/spec.js`).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import MarkdownIt from "markdown-it";
import anchorPlugin from "markdown-it-anchor";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SRC = resolve(root, "src");
const DIST = resolve(root, "dist");

/**
 * Heading IDs are derived from the leading section number:
 *   "5. Workflows"          → s-5
 *   "5.1 Standard Change"   → s-5-1
 *   "§5  Workflows"         → s-5    (after § prefixing)
 * Anything without a leading number falls back to a normal slug.
 */
const slugify = (s) => {
  const trimmed = String(s).trim();
  const m = trimmed.match(/^§?(\d+)(?:\.(\d+))?/);
  if (m) return m[2] ? `s-${m[1]}-${m[2]}` : `s-${m[1]}`;
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export function buildSpec() {
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: true,
  });

  md.use(anchorPlugin, {
    level: [2, 3],
    slugify,
    permalink: anchorPlugin.permalink.linkInsideHeader({
      symbol: "#",
      placement: "after",
      class: "h-anchor",
      ariaHidden: true,
    }),
  });

  // Style fenced code blocks as terminal panels (matches the FAQ style on index.html).
  md.renderer.rules.fence = (tokens, idx) => {
    const escaped = md.utils.escapeHtml(tokens[idx].content).replace(/\n$/, "");
    return `<pre class="terminal"><code>${escaped}</code></pre>`;
  };

  // Wrap tables so they horizontally scroll on narrow viewports without breaking layout.
  const renderToken = (tokens, idx, opts, env, self) =>
    self.renderToken(tokens, idx, opts);

  md.renderer.rules.table_open = (tokens, idx, opts, env, self) =>
    `<div class="table-wrap">${renderToken(tokens, idx, opts, env, self)}`;

  md.renderer.rules.table_close = (tokens, idx, opts, env, self) =>
    `${renderToken(tokens, idx, opts, env, self)}</div>`;

  const source = readFileSync(resolve(SRC, "spec.md"), "utf8");

  const titleMatch = source.match(/^#\s+(.+)$/m);
  const pageTitle = titleMatch ? titleMatch[1].trim() : "Specification";

  // Collect top-level section headings (## N. Title) for the table of contents.
  const tocEntries = [];
  const tocRe = /^##\s+(\d+)\.\s+(.+)$/gm;
  let match;
  while ((match = tocRe.exec(source)) !== null) {
    tocEntries.push({
      id: `s-${match[1]}`,
      num: match[1],
      title: match[2].trim(),
    });
  }

  const tocHtml = `<nav class="toc" aria-label="Table of contents">
<span class="section-prompt"><span class="sigil">$</span> man gitmomentum --toc</span>
<ol class="toc__list">${tocEntries
    .map(
      (e) =>
        `<li><a href="#${e.id}"><span class="toc__num">§${e.num}</span><span class="toc__title">${md.utils.escapeHtml(
          e.title,
        )}</span></a></li>`,
    )
    .join("")}</ol>
</nav>`;

  // Prefix section numbers with "§" so headings read "§5  Workflows" / "§5.1  …".
  const processedSource = source
    .replace(/^(##\s+)(\d+)\.\s+/gm, "$1§$2  ")
    .replace(/^(###\s+)(\d+\.\d+)\s+/gm, "$1§$2  ");

  let contentHtml = md.render(processedSource);

  // The page-level H1 is rendered by the template; drop it from the content body.
  contentHtml = contentHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");

  const template = readFileSync(resolve(SRC, "spec.template.html"), "utf8");

  const output = template
    .replace(/{{\s*title\s*}}/g, md.utils.escapeHtml(pageTitle))
    .replace(/{{\s*toc\s*}}/g, tocHtml)
    .replace(/{{\s*content\s*}}/g, contentHtml);

  mkdirSync(DIST, { recursive: true });
  writeFileSync(resolve(DIST, "spec.html"), output);

  const kb = (output.length / 1024).toFixed(1);
  console.log(`✓ dist/spec.html (${kb} KB, ${tocEntries.length} sections)`);
}

// Allow running directly: `node build/spec.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSpec();
}
