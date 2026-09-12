# Epic 4: Docs & Release Polish

Status: pending approval (Architect: sound with improvements, all fixes applied; low-risk, docs-only epic, hard-blocked on Epic 2 + Epic 3 completion regardless so there is no implementation urgency)
Bead: playwright-tui-fvm
Spec: .internal/specs/2026-09-06-playwright-tui-roadmap-design.md#epic-4--docs--release-polish
Mode: consensus (RALPLAN-DR short), non-interactive

## RALPLAN-DR Summary

**Principles**
1. This epic is media + consistency-pass only — per the roadmap spec's stress-test resolution, Epic 2 and Epic 3 each author their own docs sections as part of their own PRs (`docs/docs/usage.md` for config support, `docs/docs/features.md` for shard/project view). This epic does not do first-time authoring of that content.
2. Screenshots/recordings require the finished UI (all of Epic 2 and Epic 3's features), so this epic is hard-blocked on both, not soft — unlike the softer Epic 2/Epic 3 relationship.
3. No new features, no behavior changes — this epic touches only `README.md` and the docs site content, never `src/`.

**Decision Drivers**
1. `README.md:12` has a standing `<!-- TODO: Add terminal screenshots/recordings -->` marker to remove.
2. `docs/docs/usage.md` and `docs/docs/features.md` will already document config support and shard/project view (from Epic 2/3's own PRs) by the time this epic starts — this epic's job is to verify consistency, not write from scratch.
3. `README.md:87-90`'s options table duplicates some content that lives in `docs/docs/usage.md` — flagged as a cross-epic drift risk during Epic 2's review, unresolved until now.
4. The docs site build (`deploy-docs.yml`) is the only automated check available for this epic — there's no content-correctness test, so verification here is manual review, same as Epic 2/3's pre-harness verification.

**Viable Options**

- **Option A — Capture real terminal output for screenshots/recordings; do a full consistency pass across the docs corpus against Epic 2/3's PRs (Recommended, widened during review).** Record actual `playwright-tui` runs (interactive dashboard, headless mode, config file in use, multi-project/shard view) using a terminal-recording tool that actually renders inline in a GitHub README — `vhs` (emits a GIF directly) or plain PNG screenshots; **not asciinema**, whose player embeds don't render inline in GitHub markdown (a link/badge image is not the recording itself) — implementer's choice between `vhs`/PNGs, no new runtime dependency either way since capture tooling is dev-only and not shipped, unless a player were later embedded into the Docusaurus site itself, which this epic doesn't do. Cross-reference the **entire docs corpus** (`docs/docs/usage.md`, `docs/docs/features.md`, `docs/docs/examples.md`, `docs/docs/keyboard-shortcuts.md`, `docs/docs/getting-started.md`, `README.md`) against Epic 2/3's actual shipped behavior (not just their PR descriptions) for drift, since implementation details can shift during Epic 2/3's own review cycles between plan and merge — widened from an initial "just the two files each epic authored" scope, found during review to under-cover the actual drift surface: the docs corpus is small enough (roughly 490 lines across 5 site pages, plus a 158-line README) that reading all of it costs about the same as reading two files, and the keyboard-shortcuts table, examples page, and README's feature list/architecture tree are all real, unowned drift risks that a narrower pass would silently miss.
  - Pros: screenshots reflect real, current behavior rather than mockups; consistency pass catches drift introduced during Epic 2/3's own implementation (which may differ in small ways from their plans after their own review rounds).
  - Cons: requires Epic 2 and Epic 3 to be fully merged first — no way to shortcut this with placeholder content without defeating the purpose.

- **Option B — Use mockup/staged screenshots instead of real captures.** Design a representative terminal layout without running the actual tool.
  - Pros: doesn't block on Epic 2/3 completion.
  - Cons: directly contradicts the roadmap spec's intent (real screenshots showing the actual shipped tool) and risks the exact kind of doc/reality drift this epic exists to close out; rejected.

- **Option C — Skip screenshots, do only the consistency pass.** Leave the `README.md` TODO marker in place.
  - Pros: unblocks partially on just the consistency-pass half.
  - Cons: leaves the one concrete, long-standing TODO item (present since before this roadmap existed) unresolved, which is the epic's most visible deliverable; rejected.

**Recommendation:** Option A. This epic's value is entirely in reflecting real, current behavior — there's no meaningful partial-credit version.

## Requirements Summary

Record real terminal screenshots/recordings of `playwright-tui` (interactive dashboard, headless mode, config file behavior, multi-project/shard view) and use them to replace `README.md:12`'s TODO marker. Do a consistency pass over the **entire docs corpus** (`docs/docs/*.md` and `README.md`) against Epic 2/3's actual shipped behavior (not just their plans) — not just the two files each epic directly authored. Verify the docs site builds cleanly with the updated content, using the docs site's actual `pnpm` toolchain (`docs/` is a separate pnpm/Docusaurus workspace from the root `bun` project — confirmed against `.github/workflows/deploy-docs.yml`). This epic is hard-blocked on Epic 2 and Epic 3 both being complete — there is no partial-implementation path.

## Acceptance Criteria

1. `README.md:12`'s `<!-- TODO: Add terminal screenshots/recordings -->` marker is removed and replaced with real media (a `vhs`-recorded GIF and/or PNG screenshots — not an asciinema embed, which doesn't render inline in GitHub markdown) showing the interactive dashboard mid-run, reflecting the actual current UI including any Epic 3 multi-project/shard elements if those are visible in the captured scenario. Captured media is committed under `docs/static/img/` (the only path Docusaurus serves static assets from, and the only path `deploy-docs.yml`'s `docs/**` trigger filter watches — media committed elsewhere wouldn't trigger a docs redeploy and Docusaurus couldn't serve it anyway) and referenced from `README.md` via its full GitHub-resolvable path.
2. `docs/docs/usage.md` (authored by Epic 2 for config file support) is reviewed against Epic 2's **actual shipped code** (not its plan) for accuracy — field names, precedence behavior, error message wording, file locations — and corrected if drifted.
3. `docs/docs/features.md` (authored by Epic 3 for shard/project view) is reviewed against Epic 3's **actual shipped code** for the same kind of drift, including the `p` keybind, the worker-panel labeling (not filtering) behavior, and the ring-buffer limitation note from Epic 3's Acceptance Criterion 8.
4. **Widened during review** — the consistency pass also covers: `README.md:96-108`'s keybind table and `docs/docs/keyboard-shortcuts.md:12-19`'s action-key table, both of which currently lack Epic 3's `p` keybind and are the two places most likely to be read for it; `docs/docs/examples.md:23-77`, which is entirely CLI-flag examples that Epic 2's config-file support makes incomplete in the same way the README options table does; `README.md:16-28`'s Features bullet list, which currently has no config-file or multi-project/shard bullet; and `README.md:112-129`'s Architecture tree, which matches today's `src/` layout exactly and will need updating once Epic 2/3 add files (this is fair game for this epic even though Acceptance Criterion 6 forbids changing `src/` itself — the README's *description* of `src/` is docs content).
5. `README.md:85-92`'s options table (corrected citation — the table spans 85-92, including the `-h`/`-v` rows omitted by an earlier draft's 87-90 range) is checked for consistency with `docs/docs/usage.md`'s config-file-equivalent CLI flags (a cross-epic drift risk identified during Epic 2's review) — updated if needed, or an explicit note added if the two are intentionally scoped differently (README covers CLI flags only, docs site covers CLI + config file).
6. The docs site builds without errors using the updated content, via its actual toolchain: `cd docs && pnpm install --frozen-lockfile && pnpm build` (matching `.github/workflows/deploy-docs.yml:28-40` exactly — the docs site is a separate pnpm/Docusaurus workspace, not part of the root repo's `bun` toolchain, corrected during review from an initial draft that assumed `bun`).
7. No change to any file under `src/`, `reporter/`, or `.github/workflows/` — this epic is documentation-and-media only.

## Implementation Steps

1. Confirm Epic 2 and Epic 3 are both merged/complete before starting (hard dependency, not soft).
2. Set up a scratch Playwright project with multiple projects and a config file, to capture representative scenarios in one place.
3. Record: interactive dashboard mid-run (default single-project view), interactive dashboard with multi-project tabs active, headless mode output, and a config-file-driven run's `Command: ...` line (from Epic 2's `printedCommand` addition).
4. Update `README.md` per Acceptance Criterion 1, committing captured media under `docs/static/img/`.
5. Review and correct `docs/docs/usage.md` per Acceptance Criterion 2.
6. Review and correct `docs/docs/features.md` per Acceptance Criterion 3.
7. Review and correct the widened-scope set per Acceptance Criterion 4: `README.md`'s keybind table, `docs/docs/keyboard-shortcuts.md`, `docs/docs/examples.md`, `README.md`'s Features list, and `README.md`'s Architecture tree.
8. Reconcile `README.md`'s options table per Acceptance Criterion 5.
9. Build the docs site locally (`cd docs && pnpm install --frozen-lockfile && pnpm build`) and confirm no errors, per Acceptance Criterion 6.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Epic 2 or Epic 3's actual shipped implementation drifts from their own plans during their own review cycles, making this epic's docs review target a moving definition of "correct" | Acceptance Criteria 2-3 explicitly review against **shipped code**, not the plan documents, specifically to catch this |
| Screenshots become stale again immediately after future feature work | Out of scope for this epic to prevent — noted as a natural consequence of point-in-time captures, not a defect to solve here |
| This epic is fully blocked on two other epics, both of which went through non-trivial consensus revision — if either epic's implementation is delayed, this epic can't start | Acknowledged as an accepted hard dependency (Principle 2) — no workaround attempted, since screenshots of an unfinished feature would be actively misleading |

## Verification Steps

1. Visual review: `README.md` screenshot/recording section renders correctly (media resolves under `docs/static/img/`) and reflects current behavior.
2. Manual diff review: `docs/docs/usage.md`, `docs/docs/features.md`, `docs/docs/examples.md`, `docs/docs/keyboard-shortcuts.md`, and `README.md`'s keybind table/Features list/Architecture tree, all against the actual merged Epic 2/Epic 3 source (not their plan documents).
3. `cd docs && pnpm install --frozen-lockfile && pnpm build` succeeds locally.
4. `bd show playwright-tui-fvm` acceptance criteria checked off before closing.

## Follow-ups

- None currently.

## Changelog (Planner revisions applied after Architect review)

Architect verdict: sound with improvements — scoping direction was right, but the consistency-pass scope was narrower than the actual drift surface, and one acceptance criterion named the wrong toolchain. Applied:

1. **[finding]** Widened the consistency pass from just `docs/docs/usage.md` + `docs/docs/features.md` (the two files Epic 2/3 directly author) to the entire docs corpus: `docs/docs/examples.md`, `docs/docs/keyboard-shortcuts.md`, and README's keybind table/Features list/Architecture tree. Found during review: Epic 3's `p` keybind would otherwise ship undocumented in the two places most likely to be read for it, and Epic 2's config support makes `examples.md`'s all-CLI-flag content incomplete the same way the README options table was already flagged as at risk.
2. **[finding]** Corrected Acceptance Criterion 5's (was 4) citation from `README.md:87-90` to `README.md:85-92` — the original range omitted the `-h`/`-v` rows.
3. **[finding]** Fixed Acceptance Criterion 6's (was 5) build command — the docs site uses `pnpm`/Docusaurus (`.github/workflows/deploy-docs.yml:28-40`), not `bun`; the original wording's hedge kept it from being a hard blocker, but the command is now stated exactly.
4. **[finding]** Added a media-asset-location requirement (`docs/static/img/`) to Acceptance Criterion 1 — previously unspecified, which mattered concretely since Docusaurus only serves static assets from `docs/static/` and the deploy workflow's path filter only watches `docs/**`.
5. **[finding]** Dropped asciinema from Option A's tooling suggestion — its player embeds don't render inline in GitHub README markdown (only a link/badge), which would have silently failed to satisfy Acceptance Criterion 1's intent; `vhs` or plain PNGs are named instead.

Not applied: none — all Architect findings were accepted as-is; no disagreements to record.
