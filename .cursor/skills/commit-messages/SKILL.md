---
name: commit-messages
description: Writes commit messages for the gitmomentum repository following the Git Momentum project convention (`<type>: <subject>` with optional body). Use whenever preparing a commit, squash-merge title, amend, or direct push to `main` or `production` in this repo, or when the user asks for help drafting a commit message.
---

# Commit Messages

This project's commit convention is defined in `PROJECT.md`. All squash-merge and direct-push commits to `main` and `production` MUST use the format below. `PROJECT.md` is authoritative; if this skill ever drifts from it, update this skill.

## Format

```
<type>: <subject>

<optional body>
```

## Types

Pick the **one** type that best matches the dominant change:

| Type    | Use when the change is to...                                                                   |
| ------- | ---------------------------------------------------------------------------------------------- |
| `spec`  | The specification document (`src/spec.md`).                                                    |
| `site`  | Website copy, design, or structure (everything else under `src/`, e.g. `index.html`, `*.css`). |
| `fix`   | A correction to either spec or site. Prefer `fix` over `spec`/`site` when repairing a defect.  |
| `docs`  | Documentation other than the spec — `README.md`, `PROJECT.md`, `LICENSE` notes, etc.           |
| `build` | Build system, dependencies, tooling (`build/`, `package.json`, `pnpm-lock.yaml`).              |
| `ci`    | CI / deployment configuration (`vercel.json`, GitHub Actions, etc.).                           |
| `chore` | Anything else (`.gitignore`, miscellaneous repo hygiene).                                      |

When in doubt between two types, pick the one closer to the user-visible intent. A wording correction in the spec is `fix`, not `spec`. A new spec section is `spec`. A new landing-page section is `site`.

## Subject rules

- **Imperative mood**: "add", not "added" or "adds".
- **Lowercase** first letter after the colon.
- **No trailing period**.
- **≤ 72 characters** total on the first line (including `<type>: `).
- Describe **what changed**, not which file.

## Body rules (optional)

Include a body only when it adds non-obvious context. Skip it for trivial or self-explanatory changes.

- Blank line between subject and body.
- Wrap at ~72 characters.
- Explain **why**, not what (the diff already shows what).
- Reference issues / PRs by URL or `#number` when relevant.

## Workflow

1. Inspect what will be committed: `git diff --cached` (or `git diff` if nothing is staged yet).
2. Pick the single dominant type from the table above.
3. Write the subject in imperative mood, lowercase, no period, ≤ 72 chars.
4. Decide whether a body is necessary. If yes, explain *why* and any non-obvious context.
5. Run the pre-commit checklist below.
6. Commit using a heredoc so the body formats correctly:

   ```bash
   git commit -m "$(cat <<'EOF'
   <type>: <subject>

   <optional body>
   EOF
   )"
   ```

## Pre-commit checklist

- [ ] Type is one of: `spec`, `site`, `fix`, `docs`, `build`, `ci`, `chore`.
- [ ] First word after `<type>: ` is lowercase.
- [ ] Subject is imperative ("add", not "added" / "adds" / "adding").
- [ ] No trailing period on the subject.
- [ ] First line ≤ 72 characters.
- [ ] Subject describes the change, not the file.
- [ ] Body (if present) is separated by a blank line and explains *why*.
- [ ] Body lines wrap at ~72 characters.

## Examples

Spec clarification, with body explaining why:

```
spec: clarify deployment branch fast-forward rule

Section 3.2 previously implied that promotion is always from the
tip of main. Wording updated to make clear that any commit on
main's history is a valid target.
```

Small site tweak, no body:

```
site: tighten landing-page hero copy
```

Dependency bump:

```
build: upgrade markdown-it to 14.2.0
```

Spec typo:

```
fix: correct typo in promotion section
```

CI / deployment config change:

```
ci: cache pnpm store between vercel builds
```

PROJECT.md edit:

```
docs: document hotfix back-merge expectation
```

## Common mistakes to avoid

- `Spec: Clarify deployment rule.` — capitalized type, capitalized subject, trailing period. Should be `spec: clarify deployment rule`.
- `spec: clarified deployment rule` — past tense. Should be `spec: clarify deployment rule`.
- `spec: update spec.md` — names the file, not the change. Should describe what changed (e.g. `spec: clarify deployment branch fast-forward rule`).
- `chore: misc updates` — too vague. Pick a specific subject, or split the commit.
- Adding a body that restates the subject. If the body would only repeat the diff or the subject, omit it.

## Source of truth

`PROJECT.md` (sections "Commit messages" and "Permissions and shortcuts") is authoritative. The Git Momentum workflow spec lives at <https://www.gitmomentum.com/spec.html>.
