# playwright-tui remaining-work roadmap

Date: 2026-09-06
Status: approved, stress-tested (8/8 branches resolved)
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
- Tests for `reporter/playwrightTuiReporter.cjs` — call the reporter's
  Playwright-reporter-interface methods directly with synthetic test-result
  objects (no real browser/test execution) and assert on the NDJSON lines
  written.
- Ink snapshot tests for `src/tui/Dashboard.tsx` where practical (ink
  supports snapshot rendering via `ink-testing-library` or equivalent — pick
  during implementation planning).

**Out of scope:** CI workflow to gate PRs on tests/lint (user explicitly
excluded CI/lint hardening from this roadmap).

**Acceptance criteria:**
- `bun test` runs and passes locally with no external network/browser deps.
- Controller state machine, timing history, and format utils each have
  coverage for their core branches (happy path + at least one edge case).
- Reporter emits verifiable NDJSON events under test, driven by synthetic
  reporter-interface calls (no real browser execution).

### Epic 2 — Config File Support

**Goal:** allow default wrapper options to be set via a config file instead
of only CLI flags.

**Scope:**
- Support `.playwright-tuirc.json` in the target `--cwd` directory, and/or a
  `"playwright-tui"` key in that directory's `package.json`.
- Precedence: CLI flag > config file > built-in default. If both
  `.playwright-tuirc.json` and a `package.json` `"playwright-tui"` key exist,
  the standalone file wins entirely — the `package.json` key is ignored, not
  merged.
- Config-able fields (v1): `history` (bool), `historyFile` (path), `runner`
  (`auto|bunx|npx`).
- Config loading/merge logic lives alongside existing arg parsing in
  `src/cli.tsx`; document the shape in `src/types.ts`.
- Errors fail fast with a clear message rather than silently ignoring or
  coercing bad input — covers both malformed JSON and type-invalid values
  (e.g. `"runner": 5`, `"history": "yes"`); type errors name the offending
  field and expected type.
- Epic's own docs update: `docs/docs/usage.md` documents the config file
  (location, precedence, fields, error behavior) as part of this epic's PR,
  not deferred to Epic 4.

**Acceptance criteria:**
- Running with no CLI flags but a config file present uses the config
  file's values.
- CLI flags override config file values.
- When both config sources exist, the standalone file's values are used and
  the `package.json` key is ignored.
- Malformed JSON produces a clear, actionable error (not a stack trace).
- A validly-parsed config with a wrong-typed field also fails fast with a
  field-specific error (not silently coerced or ignored).
- `docs/docs/usage.md` documents config file support.
- Covered by tests added under Epic 1's harness.

### Epic 3 — Multi-Project/Shard View

**Goal:** first-class TUI visibility when Playwright runs multiple
`--project` targets and/or `--shard` runs.

**Dependency on Epic 2 is soft, not hard:** the only actual coupling is
reading an optional default-project-filter from config. Header shard index,
per-project panel grouping, and per-project summary stats are independent of
Epic 2 and can be built even if Epic 2 hasn't shipped yet — the
config-driven default-filter piece just can't be wired until it does.

**Scope:**
- Header bar shows shard index/total when `--shard` is in effect.
- Spec-files and worker panels group/label entries by Playwright project
  when multiple projects are active.
- Summary panel aggregates stats per project in addition to the overall
  total.
- Reads any related defaults (e.g. default project filter) via Epic 2's
  config plumbing, once available.
- Many-project / many-shard layouts degrade gracefully (e.g. scrollable
  per-project sections, or a compact project-tabs selector past a project
  count threshold) rather than overflowing the terminal — exact threshold
  and mechanism are decided in this epic's own implementation plan, but
  graceful degradation itself is a hard requirement, not an afterthought.
- Epic's own docs update: `docs/docs/features.md` documents multi-project
  and shard view behavior as part of this epic's PR, not deferred to Epic 4.

**Acceptance criteria:**
- Running with `--project=chromium --project=firefox` visibly distinguishes
  per-project progress in the TUI.
- Running with `--shard=1/3` (etc.) shows shard index/total in the header.
- Existing single-project, non-sharded runs are visually unchanged.
- A high project/shard count (e.g. 6+ projects) degrades gracefully — no
  overflow or unreadable layout — via whatever mechanism the epic's plan
  chooses.
- `docs/docs/features.md` documents multi-project/shard view.
- Covered by tests added under Epic 1's harness.

### Epic 4 — Docs & Release Polish

**Goal:** screenshots/media (which need the finished UI) plus a final
consistency pass — not first-time authoring of the Epic 2/3 doc content,
which each of those epics now writes as part of their own PR.

**Scope:**
- Record terminal screenshots/GIF for the README, replacing the existing
  `<!-- TODO: Add terminal screenshots/recordings -->` marker.
- Final consistency pass over `docs/docs/features.md` and
  `docs/docs/usage.md` (content authored in Epics 2–3) — catch drift, not
  write from scratch.
- Verify the docs site (`deploy-docs.yml`) builds cleanly with the updated
  content.

**Acceptance criteria:**
- README screenshot TODO is removed and replaced with real media.
- Docs site content is consistent with shipped config-file and
  shard/project-view behavior.
- Docs site build succeeds.

## Sequencing & Dependencies

```
Epic 1 (Test Infra)
    └── Epic 2 (Config File Support)
    └── Epic 3 (Multi-Project/Shard View)   [soft dep on Epic 2: only the
                                              default-project-filter piece
                                              needs Epic 2 to be done]
            └── Epic 4 (Docs & Release Polish)
```

Each epic gets its own brainstorm/plan cycle (per-epic `oh-my-claudecode:plan`
with consensus + architect review) before implementation beads are seeded,
per the parent tracking request. This document defines scope and ordering
only — implementation detail is deferred to each epic's own plan.

## Explicitly Out of Scope

- CI/lint hardening (ESLint/Prettier config, PR-gating workflow) — user
  declined to include this in the current roadmap.

## Stress Test Results: playwright-tui roadmap design

### Resolved Decisions
- Epic2→Epic3 dependency reclassified as soft (only default-project-filter
  is coupled; everything else in Epic 3 is independent).
- `bun test` confirmed over vitest/jest — zero new deps, Bun already
  required for `build:exe`.
- Config source precedence: `.playwright-tuirc.json` wins entirely over a
  `package.json` key when both exist (no merge).
- Config validation extended to type-invalid values, not just malformed
  JSON — fail-fast with field-specific errors either way.
- Epic 3 must degrade gracefully at high project/shard counts — named as a
  hard acceptance criterion, mechanism deferred to that epic's plan.
- Docs authoring moved into Epic 2 and Epic 3 themselves (each PR documents
  its own feature); Epic 4 reduced to screenshots + consistency pass.
- Config-file `historyFile` path risk accepted as equivalent to the
  existing `--history-file` CLI flag — no new mitigation needed, no new
  capability introduced.
- Epic 1's reporter test reworded to call reporter-interface methods with
  synthetic data directly, not a real scripted Playwright/browser run.

### Changes Made
- Spec edited in place across Epics 1–4 (see diffs); no items deferred to
  a separate follow-up epic.

### Deferred / Parking Lot
- Exact graceful-degradation mechanism and project-count threshold for
  Epic 3 (scrollable sections vs. tabs vs. other) — decided in Epic 3's own
  implementation plan.

### Confidence Assessment
- Overall: High
- Areas of concern: none blocking; Epic 3's layout-scale acceptance
  criterion is intentionally left mechanism-agnostic pending its own plan.
