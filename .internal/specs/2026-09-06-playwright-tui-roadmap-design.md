# playwright-tui remaining-work roadmap

Date: 2026-09-06
Status: approved (spec review pending)
Brainstorming session: playwright-tui-l5y

## Context

No `.omc/plans/` directory and no open GitHub issues exist in this repo — there
was no pre-existing backlog to seed from. This spec instead defines the
roadmap from scratch, based on:

- README/docs feature inventory (fully documented, matches shipped code)
- Repo gap analysis: zero automated tests (no test framework, no `test`
  script), no lint/format config, CI limited to `release.yml` +
  `deploy-docs.yml` (no PR-gating typecheck/lint/test workflow — explicitly
  **out of scope** for this roadmap per user decision), and one open README
  TODO (screenshots/recordings)
- User-specified feature gaps: config file support, multi-project/shard view

## Epics

Ordered sequentially — each depends on the prior epic's foundation.

### Epic 1 — Test Infrastructure & Coverage

**Goal:** establish a safety net before further feature work.

**Scope:**
- Add `bun test` as the test runner (already the project's runtime; no new
  dependency) and a `test` script in `package.json`.
- Unit tests for `src/controller/runController.ts` — event → `RunState`
  transitions (run-begin, test-begin, test-end, run-end, fatal).
- Unit tests for `src/history/timingHistoryStore.ts` — EMA calculation,
  50-run cap, median fallback for unknown tests, persistence round-trip,
  `XDG_CONFIG_HOME` path resolution.
- Unit tests for `src/utils/format.ts` — duration/percentage/string
  formatting, pure functions.
- Tests for `reporter/playwrightTuiReporter.cjs` — verifies correct NDJSON
  event shape/sequence is emitted for a scripted Playwright run.
- Ink snapshot tests for `src/tui/Dashboard.tsx` where practical (ink
  supports snapshot rendering via `ink-testing-library` or equivalent — pick
  during implementation planning).

**Out of scope:** CI workflow to gate PRs on tests/lint (user explicitly
excluded CI/lint hardening from this roadmap).

**Acceptance criteria:**
- `bun test` runs and passes locally with no external network/browser deps.
- Controller state machine, timing history, and format utils each have
  coverage for their core branches (happy path + at least one edge case).
- Reporter emits verifiable NDJSON events under test.

### Epic 2 — Config File Support

**Goal:** allow default wrapper options to be set via a config file instead
of only CLI flags.

**Scope:**
- Support `.playwright-tuirc.json` in the target `--cwd` directory, and/or a
  `"playwright-tui"` key in that directory's `package.json`.
- Precedence: CLI flag > config file > built-in default.
- Config-able fields (v1): `history` (bool), `historyFile` (path), `runner`
  (`auto|bunx|npx`).
- Config loading/merge logic lives alongside existing arg parsing in
  `src/cli.tsx`; document the shape in `src/types.ts`.
- Errors (malformed JSON, unknown keys) fail fast with a clear message
  rather than silently ignoring the file.

**Acceptance criteria:**
- Running with no CLI flags but a config file present uses the config
  file's values.
- CLI flags override config file values.
- Malformed config file produces a clear, actionable error (not a stack
  trace).
- Covered by tests added under Epic 1's harness.

### Epic 3 — Multi-Project/Shard View

**Goal:** first-class TUI visibility when Playwright runs multiple
`--project` targets and/or `--shard` runs.

**Scope:**
- Header bar shows shard index/total when `--shard` is in effect.
- Spec-files and worker panels group/label entries by Playwright project
  when multiple projects are active.
- Summary panel aggregates stats per project in addition to the overall
  total.
- Reads any related defaults (e.g. default project filter) via Epic 2's
  config plumbing.

**Acceptance criteria:**
- Running with `--project=chromium --project=firefox` visibly distinguishes
  per-project progress in the TUI.
- Running with `--shard=1/3` (etc.) shows shard index/total in the header.
- Existing single-project, non-sharded runs are visually unchanged.
- Covered by tests added under Epic 1's harness.

### Epic 4 — Docs & Release Polish

**Goal:** close out documentation debt, including debt newly created by
Epics 2–3.

**Scope:**
- Record terminal screenshots/GIF for the README, replacing the existing
  `<!-- TODO: Add terminal screenshots/recordings -->` marker.
- Update `docs/docs/features.md` and `docs/docs/usage.md` to document config
  file support (Epic 2) and multi-project/shard view (Epic 3).
- Verify the docs site (`deploy-docs.yml`) builds cleanly with the updated
  content.

**Acceptance criteria:**
- README screenshot TODO is removed and replaced with real media.
- Docs site content reflects config file support and shard/project view.
- Docs site build succeeds.

## Sequencing & Dependencies

```
Epic 1 (Test Infra)
    └── Epic 2 (Config File Support)
            └── Epic 3 (Multi-Project/Shard View)
                    └── Epic 4 (Docs & Release Polish)
```

Each epic gets its own brainstorm/plan cycle (per-epic `oh-my-claudecode:plan`
with consensus + architect review) before implementation beads are seeded,
per the parent tracking request. This document defines scope and ordering
only — implementation detail is deferred to each epic's own plan.

## Explicitly Out of Scope

- CI/lint hardening (ESLint/Prettier config, PR-gating workflow) — user
  declined to include this in the current roadmap.
