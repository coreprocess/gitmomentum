/**
 * build/changelog.js — renders dist/changelog.html from git history.
 *
 * Each commit on whatever HEAD is currently checked out becomes one row.
 * The version column is `git describe --tags --candidates=100
 * --match='v[0-9]*' <sha>`, per the convention defined in PROJECT.md, so
 * tagged commits show their tag and every other commit shows its
 * relationship to the closest tag (e.g. `v0.1.0-3-gabcd123`). Tagged
 * commits also get an HTML anchor (`#v1-2-3`) so releases can be linked
 * to directly.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const SRC = resolve(root, "src");
const DIST = resolve(root, "dist");

const REPO_URL = "https://github.com/coreprocess/gitmomentum";
const TAG_GLOB = "v[0-9]*";

// Recognised commit-message types (see PROJECT.md → Conventions → Commit messages).
const TYPES = ["spec", "site", "fix", "docs", "build", "ci", "chore"];
const SUBJECT_RE = new RegExp(`^(${TYPES.join("|")}):\\s*(.+)$`);

const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const tryGit = (...args) => {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const versionAnchor = (tag) =>
  tag.replace(/\./g, "-").replace(/[^a-z0-9-]/gi, "-").toLowerCase();

export function buildChangelog() {
  const commits = readCommits();
  const html = render(commits);

  mkdirSync(DIST, { recursive: true });
  writeFileSync(resolve(DIST, "changelog.html"), html);
  console.log(`✓ dist/changelog.html (${commits.length} commits)`);
}

function readCommits() {
  const hasCommits = tryGit("rev-parse", "--verify", "HEAD") !== null;
  if (!hasCommits) return [];

  const SEP = "\x1f";
  const REC = "\x1e";
  const FORMAT = ["%H", "%h", "%s", "%aI", "%an"].join(SEP) + REC;
  const log = git("log", "--no-merges", `--format=${FORMAT}`, "HEAD");

  return log
    .split(REC)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, short, subject, iso, author] = entry.split(SEP);
      const m = subject.match(SUBJECT_RE);

      const version = tryGit(
        "describe",
        "--tags",
        "--candidates=100",
        `--match=${TAG_GLOB}`,
        sha,
      );

      // A commit is "tagged" when git describe returns the bare tag (no `-N-g…` suffix).
      const isExactTag = Boolean(version && /^v[0-9][^\s-]*$/.test(version));

      return {
        sha,
        short,
        type: m ? m[1] : null,
        summary: m ? m[2] : subject,
        iso,
        date: iso.slice(0, 10),
        author,
        version: version || null,
        isExactTag,
      };
    });
}

function render(commits) {
  const tpl = readFileSync(resolve(SRC, "changelog.template.html"), "utf8");

  if (commits.length === 0) {
    const empty = `<p class="changelog-empty">No commits yet.</p>`;
    return tpl.replace(/{{\s*content\s*}}/g, empty);
  }

  const items = commits
    .map((c) => {
      const id = c.isExactTag ? ` id="${versionAnchor(c.version)}"` : "";
      const taggedClass = c.isExactTag ? " commit--tagged" : "";
      const typeClass = c.type ? `commit__type--${c.type}` : "commit__type--other";
      const typeLabel = c.type ?? "other";

      const versionCell = c.version
        ? `<span class="commit__version${c.isExactTag ? " commit__version--tag" : ""}">${escape(c.version)}</span>`
        : `<span class="commit__version commit__version--none">untagged</span>`;

      return `<li class="commit${taggedClass}"${id}>
  <a class="commit__sha" href="${REPO_URL}/commit/${c.sha}" rel="noopener" target="_blank" aria-label="View commit ${escape(c.short)} on GitHub"><code>${escape(c.short)}</code></a>
  ${versionCell}
  <span class="commit__type ${typeClass}">${escape(typeLabel)}</span>
  <span class="commit__summary">${escape(c.summary)}</span>
  <time class="commit__date" datetime="${escape(c.iso)}">${escape(c.date)}</time>
</li>`;
    })
    .join("\n");

  const content = `<ol class="commits" aria-label="Commits, newest first">\n${items}\n</ol>`;
  return tpl.replace(/{{\s*content\s*}}/g, content);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildChangelog();
}
