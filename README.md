# playwright-tui

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

A terminal UI wrapper for the [Playwright](https://playwright.dev/) test runner. Get real-time visibility into your test suite with live progress bars, worker status, failure details, and ETA estimation -- all from the terminal.

**[Documentation](https://catesandrew.github.io/playwright-tui/)**

## Screenshots

<!-- TODO: Add terminal screenshots/recordings -->

## Features

- **Header bar** with Playwright version, browser targets, worker count, and running indicator
- **Stats bar** with total/pass/fail/skip/retry counters and elapsed timer
- **Block progress bar** showing overall completion percentage
- **Spec files panel** with per-file mini progress bars and pass/fail/running indicators
- **Recent activity stream** showing completed tests with timestamps
- **Worker panel** with per-worker spinner, active test name, file, and live duration
- **Failure cards** with expandable details including error message, expected/actual values, and stack trace snippets
- **Summary panel** (`s`) showing final stats, failed tests, and slowest tests
- **ETA estimation** using persisted timing history with exponential moving averages
- **Filter mode** to search across spec files, activity, and failures
- **Watch mode** toggle for iterative development
- **Headless mode** with progress output for CI/non-TTY environments
- **Rerun controls** to rerun all tests or just failed tests without leaving the TUI

## Installation

### Pre-built binaries

Download a standalone executable for your platform from the [GitHub Releases](https://github.com/catesandrew/playwright-tui/releases) page. Available for macOS (arm64 & x64), Linux (x64), and Windows (x64).

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or [Node.js](https://nodejs.org/) 18+
- A project with [Playwright](https://playwright.dev/) tests configured

### Build from source

```bash
git clone https://github.com/catesandrew/playwright-tui.git
cd playwright-tui
bun install
```

### Compile to standalone binary

```bash
bun run build:exe
# Binary is at ./dist/playwright-tui
```

### Use the wrapper script directly

```bash
./bin/playwright-tui
```

## Usage

Run from a directory containing a `playwright.config.*` file:

```bash
# Run all tests with the TUI dashboard
bun run dev

# Pass arguments to Playwright after --
bun run dev -- -- --grep @smoke --workers=4

# Run against a different project directory
bun run dev -- -C ../my-playwright-project -- --project=chromium

# Use the bin wrapper directly
./bin/playwright-tui -- --grep login

# Use the compiled binary
./dist/playwright-tui -- --workers=8
```

### Wrapper Options

| Option | Description | Default |
|---|---|---|
| `-C, --cwd <path>` | Directory containing `playwright.config.*` | Current directory |
| `--history` / `--no-history` | Enable/disable persisted ETA history | Enabled |
| `--history-file <path>` | Custom history file path | `~/.config/playwright-tui/history.json` |
| `--runner <auto\|bunx\|npx>` | Command used to invoke Playwright | `auto` |
| `-h, --help` | Show help | |
| `-v, --version` | Show version | |

> **Note:** Do not pass `--reporter` to Playwright args. `playwright-tui` injects its own reporter bridge automatically.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `r` | Rerun failed tests (`--last-failed`) |
| `a` | Rerun all tests |
| `f` | Enter filter mode (type + `Enter` to apply, `Esc` to cancel) |
| `w` | Toggle watch mode for next run |
| `s` | Show/hide summary panel |
| `Tab` | Switch focus between spec-files and failures panels |
| `Up/Down` or `j/k` | Navigate rows in focused panel |
| `Enter` | Expand/collapse selected failure card |
| `q` | Stop running test process and quit |

## Architecture

```
playwright-tui
├── bin/
│   └── playwright-tui          # Shell wrapper entry point
├── reporter/
│   └── playwrightTuiReporter.cjs  # Playwright custom reporter (CJS)
└── src/
    ├── cli.tsx                 # CLI entry point, arg parsing, headless mode
    ├── types.ts                # Shared TypeScript types and interfaces
    ├── controller/
    │   └── runController.ts    # Process management, event handling, state machine
    ├── history/
    │   └── timingHistoryStore.ts  # Persisted timing data for ETA estimation
    ├── tui/
    │   └── Dashboard.tsx       # Ink/React terminal UI components
    └── utils/
        └── format.ts           # Duration, percentage, and string formatting
```

### How it works

1. **Reporter bridge**: `playwright-tui` injects a custom Playwright reporter (`playwrightTuiReporter.cjs`) that writes NDJSON events to a temporary file.
2. **Event polling**: The `RunController` polls the event file every 120ms, parsing reporter events (run-begin, test-begin, test-end, run-end, fatal).
3. **State management**: Events are processed into a `RunState` object tracking workers, file progress, failures, activity, and ETA.
4. **Terminal rendering**: The `Dashboard` component (built with Ink/React) subscribes to state changes and renders the multi-panel TUI layout.
5. **Timing history**: Test durations are persisted to `~/.config/playwright-tui/history.json` using exponential moving averages for accurate ETA prediction across runs.

## Tech Stack

- **[Ink](https://github.com/vadimdemedes/ink)** - React for interactive command-line apps
- **[React 18](https://react.dev/)** - Component-based UI rendering
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Bun](https://bun.sh/)** - JavaScript runtime and bundler

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run type checking: `bun run typecheck`
5. Commit your changes (`git commit -m 'Add my feature'`)
6. Push to the branch (`git push origin feature/my-feature`)
7. Open a Pull Request

## License

[MIT](LICENSE) - Andrew Cates
