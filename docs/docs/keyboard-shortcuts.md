---
sidebar_position: 4
title: Keyboard Shortcuts
---

# Keyboard Shortcuts

playwright-tui is fully keyboard-driven. All shortcuts are available while the dashboard is displayed.

## Action Keys

| Key | Action | Notes |
|---|---|---|
| `r` | Rerun failed tests | Uses `--last-failed` flag. Shows flash notification. Blocked if a run is active. |
| `a` | Rerun all tests | Starts a fresh run. Shows flash notification. Blocked if a run is active. |
| `f` | Enter filter mode | Type a search string, press `Enter` to apply or `Esc` to cancel. |
| `w` | Toggle watch mode | Adds `--watch` to the next Playwright run. Shows on/off flash notification. |
| `s` | Toggle summary panel | Shows/hides the summary overlay with final stats, failures, and slowest tests. |
| `q` | Quit | Sends `SIGINT` to stop a running process, then exits. If idle, exits immediately. |

## Navigation Keys

| Key | Action |
|---|---|
| `Tab` | Switch focus between spec files panel and failures panel |
| `Up` / `k` | Move selection up in the focused panel |
| `Down` / `j` | Move selection down in the focused panel |
| `Enter` | Expand/collapse the selected failure card (when failures panel is focused) |

## Filter Mode

When filter mode is active (triggered by `f`):

| Key | Action |
|---|---|
| Any printable character | Append to filter string |
| `Backspace` / `Delete` | Remove last character from filter string |
| `Enter` | Apply filter and exit filter mode |
| `Esc` | Cancel filter and restore previous filter state |

The filter applies to:

- **Spec files** -- matches against file paths
- **Recent activity** -- matches against test title, file path, or project name
- **Failures** -- matches against test title, file path, project name, or error message

When a filter is active, an asterisk (`*`) appears next to the `[f]` indicator in the keybind bar.

## Flash Notifications

Several actions trigger brief flash notifications displayed as a colored banner:

| Color | Meaning |
|---|---|
| Cyan | Rerunning all tests |
| Red | Rerunning failed tests |
| Green | Watch mode enabled |
| Yellow | Warning (run already in progress, no failed tests, watch mode disabled, stopping) |
