---
sidebar_position: 2
title: Features
---

# Features

playwright-tui provides a comprehensive terminal dashboard for monitoring Playwright test runs.

## Dashboard Layout

The TUI is organized into several panels that update in real time.

### Header Bar

Displays key information about the current run:

- Playwright version detected from your project
- Browser targets (chromium, firefox, webkit)
- Configured worker count
- Running/idle status indicator

### Stats Bar

A single-line summary of test execution:

- **TOTAL** -- number of tests discovered
- **PASS** -- tests that passed as expected
- **FAIL** -- tests with unexpected failures
- **SKIP** -- skipped tests
- **RETRY** -- number of retry attempts
- **ELAPSED** -- wall-clock time since run started

### Progress Bar

A block-character progress bar showing overall completion percentage with a numeric readout (e.g., `42% ████████░░░░░░░░░░ 21/50`).

### Spec Files Panel

A selectable list of test files with:

- **Status icon** -- checkmark (passed), cross (failed), circle (running), dot (pending)
- **Mini progress bar** -- color-coded segments for passed (green), failed (red), skipped (yellow), and pending (gray) tests within each file
- **Completion count** -- e.g., `3/5`

Use `Up/Down` or `j/k` to navigate; the panel scrolls automatically to keep the selection visible.

### Recent Activity Stream

A timestamped log of recently completed tests with status icons:

- `✓` passed (green)
- `✗` failed (red)
- `⊘` skipped (yellow)
- `↻` flaky (magenta)
- `⧖` timed out (red)
- `!` interrupted (yellow)

Each entry shows the test name and duration.

### Worker Panel

Displays per-worker status in a table format:

| Column | Description |
|---|---|
| `#` | Worker index |
| `TEST` | Currently executing test name |
| `FILE` | Test file path |
| `TIME` | Live duration since test started |

Idle workers show a dot indicator; active workers show a circle spinner.

### Failures Panel

Lists failed tests with expandable detail cards. Press `Enter` on a selected failure to expand it and see:

- **Error message** -- the first line of the error
- **Expected/Actual** -- matcher comparison values when available
- **Stack trace** -- up to 6 lines of stack trace with syntax highlighting for `.spec.` and `.ts:` files

Use `Tab` to switch focus between the spec files panel and failures panel.

### Summary Panel

Toggle with `s` to show/hide a summary overlay displaying:

- Final stats (total, pass, fail, skip, retry)
- Top 3 failed tests with file paths
- Top 3 slowest tests with durations

## ETA Estimation

playwright-tui uses a persisted timing history to estimate remaining time.

### How it works

1. On each test completion, the actual duration is recorded
2. Durations are stored in `~/.config/playwright-tui/history.json`
3. The algorithm uses exponential moving averages (EMA) weighted over up to 50 runs per test
4. For new tests without history, the median duration of all known tests is used as a fallback
5. ETA combines prediction-weighted progress with count-based progress for accuracy

### Configuration

- `--history` / `--no-history` -- enable or disable timing persistence
- `--history-file <path>` -- specify a custom history file location
- Respects `XDG_CONFIG_HOME` for the default path

## Filter Mode

Press `f` to enter filter mode. Type a search string and press `Enter` to apply. The filter narrows:

- Spec files panel (matches against file paths)
- Recent activity stream (matches against test title, file, or project)
- Failures panel (matches against title, file, project, or error message)

Press `Esc` to cancel without applying. An asterisk (`*`) appears next to the filter keybind when a filter is active.

## Watch Mode

Press `w` to toggle watch mode. When enabled, the next run will include `--watch` in the Playwright arguments, causing Playwright to re-run tests when source files change.

## Rerun Controls

- `r` -- rerun only failed tests (uses `--last-failed` flag)
- `a` -- rerun all tests

Both display a flash notification confirming the action. If a run is already in progress, a warning flash is shown instead.

## Headless Mode

When `playwright-tui` detects that stdin or stdout is not a TTY, it automatically switches to a compact text-based output suitable for CI environments. Progress lines are printed on each test completion with pass/fail/skip counts and ETA.
