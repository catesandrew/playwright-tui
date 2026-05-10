---
sidebar_position: 3
title: Usage
---

# Usage

## Command Syntax

```
playwright-tui [wrapper options] [playwright args...]
playwright-tui [wrapper options] -- [playwright args...]
```

Use `--` to explicitly separate playwright-tui options from arguments passed to Playwright.

## Wrapper Options

| Option | Description | Default |
|---|---|---|
| `-C, --cwd <path>` | Directory containing `playwright.config.*` | Current directory |
| `--history` | Enable persisted ETA history | Enabled |
| `--no-history` | Disable persisted ETA history | |
| `--history-file <path>` | Custom history file path | `~/.config/playwright-tui/history.json` |
| `--runner <auto\|bunx\|npx>` | Command used to invoke Playwright | `auto` |
| `-h, --help` | Show help text | |
| `-v, --version` | Show version | |

### Runner resolution

When `--runner` is set to `auto` (the default), playwright-tui checks for available runners in order:

1. `bunx` -- preferred if available
2. `npx` -- fallback

You can force a specific runner with `--runner bunx` or `--runner npx`.

### History file path

The timing history file defaults to `~/.config/playwright-tui/history.json`. If the `XDG_CONFIG_HOME` environment variable is set, the default becomes `$XDG_CONFIG_HOME/playwright-tui/history.json`.

You can override this with `--history-file /path/to/custom/history.json`. Tilde expansion (`~`) is supported.

## Important Notes

### Do not pass `--reporter`

playwright-tui injects its own custom Playwright reporter to receive test events. Passing `--reporter` as a Playwright argument will conflict with this mechanism and produce incorrect results.

If you need additional reporters, configure them in your `playwright.config.ts` file instead.

### Integration with existing projects

playwright-tui does not require any changes to your Playwright configuration. It works by:

1. Spawning `bunx playwright test` (or `npx`) in the target directory
2. Injecting a custom reporter via the `--reporter` CLI flag
3. Communicating through a temporary NDJSON event file

This means you can use it with any existing Playwright project by pointing to it with `-C`:

```bash
playwright-tui -C /path/to/my/project
```

### Environment variables

| Variable | Description |
|---|---|
| `PWTUI_REPORTER_PATH` | Override the path to the custom reporter CJS file |
| `PWTUI_EVENTS_FILE` | Used internally by the reporter to write events |
| `XDG_CONFIG_HOME` | Respected for default history file location |
