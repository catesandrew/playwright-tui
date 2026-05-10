---
sidebar_position: 1
title: Getting Started
---

# Getting Started

Get up and running with playwright-tui in minutes.

## Prerequisites

- [Bun](https://bun.sh/) (recommended) or [Node.js](https://nodejs.org/) 18+
- A project with [Playwright](https://playwright.dev/) tests configured

## Installation

### Clone and build from source

```bash
git clone https://github.com/catesandrew/playwright-tui.git
cd playwright-tui
bun install
```

### Compile to standalone binary

Build a self-contained executable that you can copy anywhere:

```bash
bun run build:exe
```

The binary will be at `./dist/playwright-tui`.

## Running

### From the playwright-tui directory

```bash
bun run dev
```

### With Playwright arguments

Use `--` to separate playwright-tui options from Playwright arguments:

```bash
bun run dev -- -- --grep @smoke --workers=4
```

### Against a different project

Point to a directory containing a `playwright.config.*` file:

```bash
bun run dev -- -C ../my-playwright-project -- --project=chromium
```

### Using the wrapper script

```bash
./bin/playwright-tui -- --grep login
```

### Using the compiled binary

```bash
./dist/playwright-tui -- --workers=8
```

## Headless mode

When stdin or stdout is not a TTY (e.g., in CI), playwright-tui automatically falls back to a compact text-based progress output:

```
Playwright TUI (headless mode)
Progress 12/48 pass=10 fail=1 flaky=0 skip=1 ETA=1m 23s
...
Done in 2m 14s. pass=46 fail=1 flaky=0 skip=1
```

## What's next?

- Learn about all [Features](./features.md)
- See [Usage](./usage.md) for CLI options
- Check the [Keyboard Shortcuts](./keyboard-shortcuts.md) reference
- Browse [Examples](./examples.md) for common workflows
