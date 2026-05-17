# Git Workflow Specification

## 1. Overview

This document specifies a Git-based development workflow for software projects that are continuously deployed to one or more environments (stages). The workflow is designed to produce a clean, mostly linear commit history while supporting parallel development, controlled releases, and urgent fixes.

### 1.1 Design Principles

The workflow rests on three principles:

1. **The trunk is append-only.** Once a commit reaches the trunk branch (`main`), its content and position in history are never rewritten.
2. **Merging is decoupled from releasing.** Code is merged into trunk as soon as it is ready to *exist*; it is released to a stage as a separate, explicit step.
3. **The repository state is the source of truth.** Versions, deployment status, and changelogs are derived from the Git history itself, not stored as files inside it.

### 1.2 Scope

This specification covers branch structure, merge rules, pull request conventions, automation triggers, feature flagging, versioning, and changelog generation. It does not prescribe a specific CI system, hosting platform, or deployment technology. A number of concrete choices (branch names, prefixes, commit message format, tag pattern, etc.) are left for each project to define; see §13 for the complete list of project-level policies.

---

## 2. Glossary

| Term | Meaning |
|------|---------|
| **Trunk** | The single long-lived branch that represents the latest integrated state of the project. Default name: `main`. |
| **Deployment branch** | A long-lived branch that points to the commit currently deployed (or to be deployed) to a specific environment. One per stage. |
| **Stage** | A deployed environment, e.g. `testing`, `staging`, `production`. |
| **Update branch** | A short-lived branch (default prefix `update/`) used to develop a new feature or a non-urgent fix. |
| **Hotfix branch** | A short-lived branch (default prefix `hotfix/`) used to develop an urgent fix that must reach production without waiting for the normal promotion path. |
| **Squash merge** | A merge strategy that condenses all commits of a source branch into a single new commit on the target branch. |
| **Merge commit** | A commit with two (or more) parents, recording that two histories were joined without rewriting either. |
| **Fast-forward** | Advancing a branch pointer to a descendant commit without creating a new commit. |
| **Direct push shortcut** | A push to `main` or `production` that bypasses the PR mechanism. Allowed only if explicitly permitted by project policy (see §13). The pushed commit MUST satisfy the same requirements as a squash-merged PR commit. |
| **Feature flag** | A runtime condition that enables or disables a piece of code based on the current stage. |

---

## 3. Branches

The workflow defines exactly four kinds of branches.

### 3.1 Trunk Branch

- **Name:** `main` by default; configurable per project.
- **Lifetime:** Permanent.
- **Purpose:** Represents the latest integrated state of the codebase. All work converges here.
- **Rules:**
  - History on `main` is append-only. No commit on `main` may ever be rewritten, removed, or reordered.
  - The only ways a commit can appear on `main` are:
    - a squash-merge from an `update/*` branch (see §5.1);
    - a merge commit from a deployment branch following a hotfix (see §5.2);
    - a direct push that serves as a shortcut for a squash-merge from an `update/*` branch, if project policy permits direct pushes (see §13). The pushed commit MUST conform to the PR commit convention (§6.1).
  - Any push to `main` that does not match one of the three forms above is prohibited.

### 3.2 Deployment Branches

- **Names:** One per stage, e.g. `testing`, `staging`, `production`. The set of stages is project-specific.
- **Lifetime:** Permanent.
- **Purpose:** Each deployment branch documents what is currently deployed (or queued for deployment) to its corresponding stage. The branch pointer *is* the record of "what is live where."
- **Content:** A deployment branch contains nothing beyond what is on `main`. It carries no environment-specific configuration, no version files, and no stage-only commits.
- **Rules:**
  - A deployment branch is updated by fast-forwarding it to a commit taken from `main`'s history. The target commit need not be the current tip of `main`; any commit reachable from `main` may be chosen.
  - The single exception is `production`, which additionally accepts hotfix commits — either as a squash-merged hotfix PR (§5.2) or, if project policy permits, as a direct push that serves as a shortcut for the same (see §13). After such a hotfix, `production` temporarily contains a commit not yet on `main`; this is resolved by the mandatory back-merge described in §5.2.
  - Promotion across stages is not transitive at the branch level: each deployment branch is updated directly from `main`, not from another deployment branch. Whether the *content* on a higher stage must first have been on a lower stage is a process question, not a branching one.

### 3.3 Update Branches

- **Default name pattern:** `update/<ticket-id-or-YYYYMMDD>-<short-description>` (e.g., `update/PROJ-123-export-csv` or `update/20260516-export-csv`). The exact pattern is project-defined (see §13).
- **Lifetime:** Short. Created when work begins, deleted after the PR is merged.
- **Purpose:** Development of any change that is not an urgent production fix — new features, refactors, non-urgent bug fixes, dependency upgrades, feature flag removals, etc.
- **Rules:**
  - Branched from `main`.
  - Internal commit structure is at the author's discretion. Commit messages on the branch need not follow any convention.
  - The author MAY merge `main` into the branch at any time to keep it up to date.
  - Merged into `main` via a pull request using squash merge (see §6).

### 3.4 Hotfix Branches

- **Default name pattern:** `hotfix/<ticket-id-or-YYYYMMDD>-<short-description>` (e.g., `hotfix/INC-42-login-500` or `hotfix/20260516-login-500`). The exact pattern is project-defined (see §13).
- **Lifetime:** Short. Created when an urgent production issue is identified, deleted after the PR is merged and the back-merge to `main` is complete.
- **Purpose:** A fix that must reach production without going through the normal `main` → stages promotion path.
- **Rules:**
  - Branched from `production`.
  - Internal commit structure is at the author's discretion.
  - Merged into `production` via a pull request using squash merge (see §6).
  - After merge, the resulting commit on `production` MUST be merged back into `main` using a regular merge commit (see §5.2).

---

## 4. Core Invariants

These properties hold at all times and are enforced by the rules in the rest of this specification.

1. **`main` is append-only.** No commit reachable from `main` is ever rewritten, dropped, or reordered.
2. **Deployment branches are ancestors of `main`**, except transiently on `production` between a hotfix landing and its back-merge.
3. **Deployment branches advance only by fast-forward to a commit on `main`'s history**, except `production`, which additionally accepts hotfix commits (via PR squash-merge or, if permitted, a direct push shortcut).
4. **Every commit on `main` is one of: a squash-merge commit from an `update/*` PR, a merge commit from a hotfix back-merge, or a direct push shortcut that conforms to the PR commit convention.**
5. **No version number is stored in the repository.** The version of any commit is derived from the Git tag graph (see §9).
6. **No file in the repository declares which stage code is deployed to.** That information lives in the branch pointers of deployment branches.

---

## 5. Workflows

### 5.1 Standard Change (Update Flow)

The flow for any non-urgent change — features, refactors, regular bug fixes, dependency bumps, feature flag removals.

1. Create an update branch from the current tip of `main`, named according to the project's pattern (default `update/<ticket-id-or-YYYYMMDD>-<short-description>`).
2. Develop on the branch. Commit freely; structure of intermediate commits does not matter.
3. Optionally merge `main` into the branch at any time to incorporate concurrent changes.
4. Open a pull request targeting `main`. The build and test pipeline, if configured, runs automatically (see §7.1).
5. After review, the PR is merged into `main` using **squash merge**. The squash commit message MUST follow the project's PR commit convention (see §6.1).
6. The update branch is deleted.
7. The new commit on `main` may now be promoted to deployment branches (see §5.3).

**Direct push shortcut.** If project policy permits (see §13), an authorized contributor MAY push a single commit directly to `main` in place of steps 1–6, provided the commit satisfies the same content and message requirements as a squash-merged PR commit. The shortcut is intended for trivial changes (typos, comment fixes, minor doc edits) where the overhead of a PR is disproportionate; project policy defines who may use it and for what kinds of changes.

### 5.2 Hotfix Flow

The flow for an urgent fix that must reach production immediately.

1. Create a hotfix branch from the current tip of `production`, named according to the project's pattern (default `hotfix/<ticket-id-or-YYYYMMDD>-<short-description>`).
2. Develop on the branch.
3. Open a pull request targeting `production`. The build and test pipeline, if configured, runs.
4. After review, the PR is merged into `production` using **squash merge**.
5. The deployment pipeline for production runs automatically (see §7.2), subject to any configured approval mechanism.
6. **Immediately after the merge**, the resulting commit on `production` MUST be merged back into `main` using a regular merge commit (i.e., not squash, not rebase).
   - This produces a two-parent merge commit on `main` whose parents are (a) the previous tip of `main` and (b) the hotfix commit on `production`.
   - This merge commit is the mechanism that keeps `main` append-only while still incorporating the hotfix: the hotfix commit on `production` is preserved unchanged, and `main` is extended (not rewritten) to include it.
7. The hotfix branch is deleted.

**Direct push shortcut.** If project policy permits (see §13), an authorized contributor MAY push a single commit directly to `production` in place of steps 1–4, provided the commit satisfies the same content and message requirements as a squash-merged hotfix PR commit. The mandatory back-merge to `main` (step 6) still applies: it is required regardless of whether the hotfix arrived via PR or via direct push, because it is what preserves the append-only invariant on `main`.

**Rationale for the merge commit.** Squashing or rebasing the hotfix into `main` would create a new commit with the same content but a different identity, leaving the original hotfix commit (already deployed on `production`) unreachable from `main`. The merge commit is the only operation that incorporates the hotfix into `main` without violating the append-only invariant.

### 5.3 Promotion to a Stage

Code is promoted to a stage by advancing the corresponding deployment branch to a commit on `main`'s history.

1. Identify the commit to promote. It may be the current tip of `main` or any earlier commit on `main`'s history.
2. Push that commit to the deployment branch as a fast-forward. The push is performed by a developer or operator with the appropriate permission, or by an automated system, depending on project preference.
3. The deployment pipeline for that stage runs automatically (see §7.2), subject to any configured approval mechanism.

Notes:
- Promotion is always from `main` to the deployment branch, never from one deployment branch to another.
- Whether a commit must have been deployed on a lower stage before being promoted to a higher one is a process matter; the workflow itself does not enforce it.

### 5.4 Feature Flag Lifecycle

When a change is large enough that it must reach `main` before it is ready for production — for instance, because stakeholders need to test it on `staging` — it is merged behind a feature flag.

1. The change is developed on an update branch as normal. The code is gated by a feature flag.
2. The feature flag is registered in the central flag definition (see §8), with stage assignments declaring on which stages the flag is active.
3. The PR is merged into `main` (squash). The change is now part of `main` but inert in any stage where the flag is not active.
4. Stage assignments may be adjusted over time via further update PRs — for example, activating the flag on `staging` once it is ready for stakeholder review.
5. When the change is ready for production, a final update PR removes the flag entirely: the gated code becomes unconditional, and the flag entry is removed from the central definition.
6. The commit produced by that PR can then be promoted to `production` (see §5.3).

### 5.5 Keeping a Working Branch Up to Date

Authors of an update or hotfix branch MAY incorporate changes from the target branch at any time by merging the target into their working branch. Because the working branch's history is discarded by the squash on merge, this choice has no effect on the eventual state of `main` or `production`.

---

## 6. Pull Requests

Changes enter `main` or `production` either via pull requests or, where project policy permits, via the direct push shortcut described in §5.1 and §5.2. Everything in this section concerns the pull request path.

### 6.1 PR Commit Convention

The squash commit message produced by merging a PR is the commit that becomes part of `main` (or `production`). It MUST follow the project's commit message convention. The convention SHOULD specify:

- A subject line in a structured format suitable for changelog generation (e.g., a Conventional Commits-style prefix such as `feat:`, `fix:`, `chore:`, `refactor:` followed by a concise description).
- A reference to the linked ticket or issue.
- A description of the change sufficient for a future reader of `main`'s history to understand what was done and why.

The exact format is project-specific but MUST be fixed and documented within the project so that automated changelog generation (see §10) is reliable. The same convention applies to direct push shortcut commits (§5.1, §5.2).

### 6.2 Merge Strategy

- PRs targeting `main` (from update branches): **squash merge only**.
- PRs targeting `production` (from hotfix branches): **squash merge only**.
- Hotfix back-merges from `production` into `main`: **regular merge commit only** (see §5.2).
- No other merge operations into `main` or deployment branches are permitted.

### 6.3 Review

Whether and how PRs are reviewed is determined by the project's review policy (see §13). Common choices include requiring at least one approving review, requiring review from a specific group (e.g., code owners), or requiring no review for certain low-risk change types. This specification does not prescribe any particular review policy.

---

## 7. Automation

### 7.1 Build and Test Pipeline

A build and test pipeline is OPTIONAL. If configured, it SHOULD run automatically on:

- Every push to `main` (i.e., every PR squash-merge, hotfix back-merge, and direct push shortcut).
- Every push that updates an open pull request targeting `main` or `production`.
- The opening of a pull request.

Its purpose is to verify that the code builds and that the test suite passes. It does not deploy anything.

### 7.2 Deployment Pipeline

A deployment pipeline runs automatically on every push to a deployment branch and deploys the new tip of that branch to the corresponding stage.

Because deployment branches only advance by fast-forward (or, on `production`, by hotfix squash-merge or direct push shortcut), every deployment corresponds to a single, identifiable commit on `main` (or on the hotfix path).

**Approval for production deployments.** The deployment pipeline for `production` SHOULD include an explicit approval mechanism so that no push to `production` triggers an unattended live deployment. Suitable mechanisms include:

- A platform-level approval gate (e.g., GitHub Environment protection rules requiring approval from a designated group before the deployment job runs).
- A two-step pipeline that first produces a plan or diff (e.g., `terraform plan`, a Kubernetes diff, a database migration preview) and pauses for manual approval before applying it.
- Any equivalent mechanism that interposes a human or out-of-band check between push and apply.

The deployment pipelines for non-production stages MAY use such mechanisms but are typically run unattended.

---

## 8. Feature Flags

### 8.1 Purpose

Feature flags decouple merging from releasing. A change that is technically complete but not yet ready for users in a given stage can be merged into `main` behind a flag, allowing development to proceed without long-lived branches.

### 8.2 Central Flag Definition

All feature flags are declared in a single file in the repository. The file is code (not configuration) and is evaluated at runtime. It declares, for each flag:

- The flag's identifier.
- The stages on which the flag is active.

Production is intentionally *not* a possible stage assignment. A flag cannot be "on in production." To enable a flagged change in production, the flag is removed entirely (see §5.4 step 5). This rule prevents the flag definition from accumulating permanent entries and ensures that production code is never gated by flag state.

### 8.3 Lifecycle

A flag's lifecycle is:

1. **Introduction:** A PR adds the flag to the central definition, with stage assignments as needed, and gates the relevant code.
2. **Adjustment:** Further PRs may change the flag's stage assignments.
3. **Removal:** A PR removes the flag entry from the central definition and removes the gating from the code, making the change unconditional. The commit produced is the one that, when promoted to `production`, releases the change to users.

---

## 9. Versioning

### 9.1 Tag Scheme

Versions are recorded as Git tags following a fixed pattern (e.g., `v1`, `v1.2`, `v1.2.3`). The exact tag format is project-defined (see §13) but MUST be consistent so that the derivation command in §9.2 produces correct results.

Tags are placed on commits on `main`. A tag declares: "this commit is version X."

### 9.2 Version Derivation

The version of any commit is computed from the tag graph using:

```
git describe --tags --candidates=100 --match=<tag-pattern>
```

The output combines the most recent matching tag with the number of commits since that tag and an abbreviated commit hash, yielding a deterministic version string for every commit. This command is the canonical way to determine the version of any commit.

### 9.3 No In-Repo Version Files

No file inside the repository declares the project's version. This eliminates an entire class of merge conflicts (version bumps colliding across branches) and removes the possibility of the declared version drifting out of sync with the actual code.

If a build artifact needs to embed a version string, it is produced by the build process from the output of the command in §9.2.

### 9.4 When to Tag

A new tag is created when a commit on `main` is declared to be a new version. The decision is made by a human at the moment a new version is to be released, or by an automated system if the project prefers. The workflow does not require every commit on `main` to be a version.

---

## 10. Changelog

The changelog is generated from commit messages on `main`. Because every commit on `main` either follows the PR commit convention (§6.1) directly or, in the case of a hotfix back-merge commit, references such a commit, the structured information in commit subjects (type prefix, ticket reference, description) is sufficient to produce a complete changelog by walking the history between two tags.

The changelog is never committed to the repository. Like the version, it is derived on demand from the Git history.

---

## 11. Properties

The rules above produce the following properties.

### 11.1 History

- `main`'s history is almost entirely linear. The only branching is the small two-parent bubble produced by each hotfix back-merge.
- Every commit on `main` corresponds to exactly one merged PR or one direct push shortcut. There are no intermediate "work in progress" commits in `main`'s history.
- The history can be read top to bottom as a sequence of described, ticketed changes.

### 11.2 Operational State

- For any stage, the question "what is currently deployed?" is answered by the tip of that deployment branch.
- For any commit, the question "what version is this?" is answered by `git describe`.
- For any version, the question "what is in it?" is answered by walking commit messages between tags.

None of these questions require querying a system outside the Git repository.

### 11.3 What Contributors Do Not Need to Do

- Contributors never need to rewrite their branch history to integrate with `main`. Merging `main` into their branch is always sufficient, because the squash on merge discards their branch's internal history.
- Contributors never edit a version file.
- Contributors never update a "what is deployed" record.
- Contributors never coordinate to avoid commit-message conflicts on a changelog file.

---

## 12. Prohibited Operations

The following operations are explicitly not allowed and MUST be prevented by branch protection rules where the hosting platform supports it.

1. Force-pushing to `main` or any deployment branch.
2. Pushing to `main` by any means other than a squash-merge of an update PR, a hotfix back-merge commit, or — where project policy permits — a direct push shortcut conforming to the PR commit convention.
3. Pushing to any non-`production` deployment branch by any means other than a fast-forward to a commit on `main`'s history.
4. Pushing to `production` by any means other than a fast-forward to a commit on `main`'s history, a squash-merge of a hotfix PR, or — where project policy permits — a direct push shortcut conforming to the PR commit convention.
5. Merging an update PR into `main` using any strategy other than squash.
6. Merging a hotfix PR into `production` using any strategy other than squash.
7. Merging a hotfix back into `main` using any strategy other than a regular merge commit.
8. Adding a feature flag entry for `production`.
9. Adding a file to the repository whose purpose is to declare the project's version.
10. Adding a file to the repository whose purpose is to declare which code is deployed to which stage.

---

## 13. Project-Defined Policies

To adopt this workflow, a project MUST define the following. Where a default is suggested by this specification, the project MAY adopt it as written.

### 13.1 Names

| Item | What to define | Default / example |
|------|----------------|-------------------|
| **Trunk branch name** | The name of the single long-lived integration branch. | `main` |
| **Deployment branch names** | One name per stage; the full set of stages used by the project. | `testing`, `staging`, `production` |
| **Update branch prefix and pattern** | The prefix and naming pattern for update branches. | `update/<ticket-id-or-YYYYMMDD>-<short-description>` |
| **Hotfix branch prefix and pattern** | The prefix and naming pattern for hotfix branches. | `hotfix/<ticket-id-or-YYYYMMDD>-<short-description>` |

### 13.2 Conventions

| Item | What to define | Notes |
|------|----------------|-------|
| **PR commit message convention** | The required format for the squash commit message produced by merging a PR (and for direct push shortcut commits). MUST be machine-parseable to support changelog generation. | See §6.1. A Conventional Commits-style format is a common choice. |
| **Version tag pattern** | The exact tag format used to mark versions, and the corresponding `--match` pattern for `git describe`. | See §9.1. Example: tags of the form `v<major>.<minor>.<patch>`, matched by `v[0-9]*`. |
| **Tag creation policy** | Whether tags are created manually by a human or automatically by a system, and on what trigger. | See §9.4. |

### 13.3 Permissions and Shortcuts

| Item | What to define | Notes |
|------|----------------|-------|
| **Direct push to `main`** | Whether direct pushes to `main` are permitted; if so, for whom (everyone, or a named subset) and under what conditions (e.g., change size, file types). | See §5.1. If forbidden, branch protection MUST block direct pushes. |
| **Direct push to `production`** | Whether direct pushes to `production` are permitted as a hotfix shortcut; if so, for whom and under what conditions. | See §5.2. The back-merge to `main` remains mandatory regardless. |
| **Promotion authority** | Who may push commits to each deployment branch (developers, operators, automation). | See §5.3. |

### 13.4 Review

| Item | What to define | Notes |
|------|----------------|-------|
| **Review policy for update PRs** | Number and source of required approvals, code-owner rules, exemptions, etc. | See §6.3. |
| **Review policy for hotfix PRs** | May differ from update PR policy given the urgency profile. | See §6.3. |

### 13.5 Automation

| Item | What to define | Notes |
|------|----------------|-------|
| **Build and test pipeline** | Whether the pipeline is configured, what it runs, and which events trigger it. | See §7.1. The pipeline is OPTIONAL. |
| **Deployment pipelines** | One per stage; what each deploys and how. | See §7.2. |
| **Production approval mechanism** | The specific mechanism that gates production deployment (e.g., GitHub Environment approvals, plan-and-apply with manual approval, equivalent). | See §7.2. SHOULD NOT be omitted for production. |

### 13.6 Feature Flags

| Item | What to define | Notes |
|------|----------------|-------|
| **Flag file location and format** | Where the central flag definition lives in the repository and how it is structured. | See §8.2. The file MUST be code evaluated at runtime, not external configuration. |
| **Stage assignment values** | The set of stage names a flag entry may reference (must not include `production`). | See §8.2. |

---

## 14. Summary

The workflow uses four branch types (trunk, deployment branches, update, hotfix), two merge strategies (squash for PRs, regular merge for hotfix back-merges), an optional direct push shortcut, one fast-forward rule (for promotions to stages), one feature flag mechanism (central, runtime, no production entries), and one version derivation (Git tags via `git describe`). Every other property — clean history, deterministic versioning, automatic changelogs, accurate deployment records — falls out of those choices.
