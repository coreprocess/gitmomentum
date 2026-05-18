---
name: version
description: Cuts a new `v<major>.<minor>.<patch>` tag on the gitmomentum repository, deciding the bump level (major / minor / patch) by analyzing the commits since the last tag. Use when the user asks to release, tag a version, cut a release, bump the version, or when preparing a promotion to `production`.
---

# Version

This project's version-tag rules are defined in `PROJECT.md` → "Names" and "Conventions → Version tags". Tags are the source of truth for versions: `git describe --tags --candidates=100 --match='v[0-9]*' --abbrev=4` derives the version of any commit, and `dist/changelog.html` is generated from those tags (see `build/changelog.js`).

## Format

Tags MUST match `^v[0-9]+\.[0-9]+\.[0-9]+$` — three numeric components, prefixed with `v`. `PROJECT.md` allows the broader glob `v[0-9]*`; the strict three-segment form is the convention enforced here. Tags are **annotated** (`git tag -a`), never lightweight, so they carry a message and a timestamp.

## Deciding the bump level

Pick the **highest applicable** level from the table. If any commit since the last tag qualifies for `major`, the release is `major`, even if other commits in the range are `minor` or `patch`.

| Level   | Bump from `vX.Y.Z` | Use when at least one commit since the last tag...                                                                                                                                                                                          |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `major` | `v(X+1).0.0`       | Breaks the spec: changes a rule teams already following Git Momentum would have to change behavior to keep following. Examples: renaming the trunk branch, removing a required step, redefining a deployment branch. Major site overhauls that remove or rename existing pages also qualify. |
| `minor` | `vX.(Y+1).0`       | Adds something net-new without breaking existing usage: a new spec section, a new optional rule, a new commit type, a new site page or major section.                                                                                       |
| `patch` | `vX.Y.(Z+1)`       | Backward-compatible polish only: spec clarifications that don't change a rule, copy tweaks, typo fixes (`fix:`), dependency / build / CI changes (`build:`, `ci:`), small style adjustments (`site:` tweaks), and `chore:` items.           |

### Mapping by commit type (fallback heuristic)

When the semantic table is ambiguous, fall back to the commit's `<type>:` prefix:

| Commit type(s) in the range                       | Default level |
| ------------------------------------------------- | ------------- |
| `spec:` that changes a required rule's behavior   | `major`       |
| `spec:` adding a new section or optional rule     | `minor`       |
| `spec:` clarifying wording only                   | `patch`       |
| `site:` adding a new page or major section        | `minor`       |
| `site:` tweaks, copy, styling                     | `patch`       |
| `fix:` / `docs:` / `build:` / `ci:` / `chore:` only | `patch`       |

Always read the commit **body** (and the diff if needed) before classifying — a `spec:` subject can hide either a clarification or a breaking change.

### Pre-1.0 mode

Apply this section whenever no tags exist yet or the latest tag's major is `0` (i.e. it matches `v0.*`):

- The first tag is `v0.1.0`.
- A `major`-class change bumps the **minor** segment instead: `v0.(Y+1).0`.
- A `minor`-class change bumps the **patch** segment: `v0.Y.(Z+1)`.
- `patch`-class changes still bump the patch segment.
- Bump to `v1.0.0` only when the maintainer explicitly declares the spec stable.

Once `v1.0.0` exists, use the standard table above without adjustment.

## Workflow

1. Confirm the target commit is on `main`'s canonical history (HEAD by default):

   ```bash
   git merge-base --is-ancestor "$COMMIT" main && echo "on main"
   ```

2. Find the last release tag, if any:

   ```bash
   git describe --tags --candidates=100 --match='v[0-9]*' --abbrev=0 2>/dev/null
   ```

3. List the commits in scope. Read both subjects and bodies:

   ```bash
   git log "$LAST_TAG"..HEAD --no-merges                # if a tag exists
   git log --no-merges                                  # first release
   ```

   Inspect individual diffs when needed: `git show <sha>`.

4. Classify each commit using the semantic table; fall back to the type heuristic if unclear. Apply pre-1.0 mode if it applies.

5. Compute the new version. Verify the tag is unused:

   ```bash
   git rev-parse --verify "refs/tags/vX.Y.Z" 2>/dev/null && echo "EXISTS"
   ```

6. Present the maintainer with:
   - the previous tag (or "first release"),
   - the commits being released,
   - the chosen bump level and one-sentence rationale,
   - the proposed new tag.

   **Wait for explicit confirmation before tagging** — `PROJECT.md` requires tags to be created manually by the maintainer.

7. Create the annotated tag at the chosen commit:

   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z" "$COMMIT"   # omit "$COMMIT" to tag HEAD
   ```

8. Verify with `git describe`:

   ```bash
   git describe --tags --candidates=100 --match='v[0-9]*' --abbrev=4 "$COMMIT"
   # expected: vX.Y.Z (no -N-g<sha> suffix means the commit is exactly tagged)
   ```

9. Do **not** push automatically. Show the maintainer the command instead:

   ```bash
   git push origin vX.Y.Z
   ```

   Promotion of `main` to `production` (which triggers the Vercel deploy of gitmomentum.com) remains a separate, maintainer-driven step.

## Pre-tag checklist

- [ ] Tag matches `^v[0-9]+\.[0-9]+\.[0-9]+$`.
- [ ] Tag does not already exist locally.
- [ ] Target commit is on `main`'s canonical history.
- [ ] Bump level matches the highest-applicable change since the last tag.
- [ ] Pre-1.0 mode applied if the current major is `0` (or if no prior tag exists).
- [ ] Tag is annotated (`git tag -a`), with a non-empty message.
- [ ] Maintainer has confirmed the proposal.

## Common mistakes to avoid

- Tagging a feature-branch tip instead of a commit on `main`. Tags must live on `main`'s canonical history; the changelog and `git describe` assume that.
- Lightweight tags (`git tag vX.Y.Z` without `-a`). Always use annotated tags.
- Bumping the major segment while pre-1.0. Apply the pre-1.0 shift instead.
- Re-tagging an existing commit because of a wrong version. Delete the local tag (`git tag -d vX.Y.Z`) and retag; if it was already pushed, that becomes a separate force-update decision for the maintainer (out of scope for this skill).
- Pushing the tag in the same step as creating it. Confirmation and push are explicitly the maintainer's call.
- Inferring a bump level from subjects alone. Read bodies and diffs.

## Source of truth

`PROJECT.md` → "Names" (tag pattern) and "Conventions → Version tags" (discovery command) are authoritative for the **format and mechanism**. The major / minor / patch **semantics** above are defined by this skill; if `PROJECT.md` later specifies them, `PROJECT.md` wins and this skill should be updated to match.
