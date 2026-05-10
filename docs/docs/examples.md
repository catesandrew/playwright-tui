---
sidebar_position: 5
title: Examples
---

# Examples

Common workflows and usage patterns for playwright-tui.

## Basic usage

Run all tests in the current directory:

```bash
playwright-tui
```

## Filter tests with grep

Run only tests matching a pattern:

```bash
playwright-tui -- --grep @smoke
```

## Set worker count

Control parallelism:

```bash
playwright-tui -- --workers=4
```

## Target a specific browser

```bash
playwright-tui -- --project=chromium
```

## Run against a different project

Point to a directory containing `playwright.config.*`:

```bash
playwright-tui -C ../my-app
```

## Combine options

Run smoke tests on chromium with 4 workers from a different directory:

```bash
playwright-tui -C ../my-app -- --grep @smoke --project=chromium --workers=4
```

## Use npx instead of bunx

Force npx as the runner:

```bash
playwright-tui --runner npx -- --grep login
```

## Disable timing history

Run without saving or loading timing data:

```bash
playwright-tui --no-history
```

## Custom history file

Store timing data in a project-specific location:

```bash
playwright-tui --history-file ./test-timings.json
```

## Iterative development workflow

A typical development workflow with playwright-tui:

1. **Start the TUI** with your tests:
   ```bash
   playwright-tui -C ../my-app
   ```

2. **Watch the dashboard** as tests execute -- monitor progress bars, worker status, and failures in real time.

3. **Toggle watch mode** by pressing `w` so tests re-run on file changes.

4. **Filter to a specific area** by pressing `f`, typing a file or test name, and pressing `Enter`.

5. **Investigate failures** by pressing `Tab` to switch to the failures panel, navigating with `j`/`k`, and pressing `Enter` to expand error details.

6. **Rerun failed tests** by pressing `r` after fixing issues -- only the previously failed tests will run.

7. **Rerun everything** by pressing `a` to confirm all tests pass.

8. **View summary** by pressing `s` to see final stats and slowest tests.

9. **Quit** by pressing `q`.

## CI integration

In non-TTY environments, playwright-tui automatically uses headless mode:

```bash
# In a CI script
playwright-tui -C ./my-app -- --workers=2
```

Output:
```
Playwright TUI (headless mode)
Progress 5/20 pass=4 fail=0 flaky=0 skip=1 ETA=45s
Progress 10/20 pass=9 fail=0 flaky=0 skip=1 ETA=22s
Progress 15/20 pass=14 fail=0 flaky=0 skip=1 ETA=10s
Progress 20/20 pass=19 fail=0 flaky=0 skip=1 ETA=--
Done in 1m 12s. pass=19 fail=0 flaky=0 skip=1
```

## Compiled binary distribution

Build and distribute a standalone binary:

```bash
# Build
bun run build:exe

# Copy to a location in PATH
cp ./dist/playwright-tui /usr/local/bin/

# Use from anywhere
cd ~/projects/my-app
playwright-tui -- --grep @regression
```
