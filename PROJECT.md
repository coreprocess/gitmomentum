# Project Guideline

This project follows the [Git Momentum](https://www.gitmomentum.com) workflow. For workflow rules, see the [specification](https://www.gitmomentum.com/spec.html). This document defines the project-specific policies.

---

## Names

| Item | Value |
|------|-------|
| Trunk branch | `main` |
| Deployment branches | `production` |
| Update branch pattern | `update/<YYYYMMDD>-<short-description>` |
| Hotfix branch pattern | `hotfix/<YYYYMMDD>-<short-description>` |

The project uses a single deployment branch, `production`, which represents the version of the site live at gitmomentum.com.

---

## Conventions

### Commit messages

When committing with an AI agent, use the [`commit-messages` skill](.cursor/skills/commit-messages/SKILL.md), which encodes the rules below.

Squash-merge and direct-push commits to `main` and `production` MUST follow:

```
<type>: <subject>

<optional body>
```

**Types:**

| Type | When to use |
|------|-------------|
| `spec` | Changes to the specification document. |
| `site` | Changes to the website (copy, design, structure). |
| `fix` | Corrections to either spec or site. |
| `docs` | Documentation that isn't the spec (README, PROJECT.md, etc.). |
| `build` | Build system, dependencies, tooling. |
| `ci` | CI configuration. |
| `chore` | Anything else. |

**Subject rules:**
- Imperative mood ("add," not "added").
- Lowercase first letter after the colon.
- No trailing period.
- ≤ 72 characters total on the first line.
- Describes what changed, not which file.

**Body:** optional, blank line above, wrapped at ~72 characters. Explains *why* and any non-obvious context.

**Example:**

```
spec: clarify deployment branch fast-forward rule

Section 3.2 previously implied that promotion is always from the
tip of main. Wording updated to make clear that any commit on
main's history is a valid target.
```

### Version tags

When tagging with an AI agent, use the [`version-tagging` skill](.cursor/skills/version-tagging/SKILL.md), which encodes the rules below and the major / minor / patch decision logic.

Pattern: `v<major>.<minor>.<patch>` (matched by `v[0-9]*`).

Tags are created manually by the maintainer on release-worthy commits. The version of any commit is derived with:

```
git describe --tags --candidates=100 --match='v[0-9]*'
```

---

## Permissions and shortcuts

| Item | Policy |
|------|--------|
| Direct push to `main` | Allowed for the maintainer. The pushed commit MUST follow the commit message convention. |
| Direct push to `production` | Allowed for the maintainer, as a hotfix shortcut. The back-merge to `main` remains mandatory. |
| Promotion authority | The maintainer pushes commits from `main`'s history to `production`. |

---

## Review

| Item | Policy |
|------|--------|
| Update PRs | May be self-merged by the maintainer. PRs from external contributors require maintainer review and approval. |
| Hotfix PRs | May be self-merged by the maintainer. |

---

## Repository layout

```
gitmomentum/
├── src/       Web sources.
├── build/     Build scripts.
└── dist/      Build output (gitignored).
```

---

## Automation

### Build pipeline

`pnpm build` produces a deployable `dist/` from `src/`. `pnpm start` builds and serves it locally.

### Deployment pipeline

Pushes to `production` trigger a Vercel deployment to gitmomentum.com. Production deployments do not require approval.

---

## Feature flags

Not used in this project. The project ships a static site and a specification document; there are no runtime-gated features.
