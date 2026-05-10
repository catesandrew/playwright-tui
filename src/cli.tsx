#!/usr/bin/env node
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { render } from 'ink'
import React from 'react'
import { RunController, type RunnerMode } from './controller/runController.js'
import { Dashboard } from './tui/Dashboard.js'
import { formatDuration } from './utils/format.js'

interface CliOptions {
  cwd: string
  historyEnabled: boolean
  historyFilePath: string | undefined
  runner: RunnerMode
  playwrightArgs: string[]
}

type ParseResult = { kind: 'run'; options: CliOptions } | { kind: 'help' } | { kind: 'version' }

const VERSION = '0.1.0'

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.kind === 'help') {
    process.stdout.write(buildHelpText())
    return
  }

  if (parsed.kind === 'version') {
    process.stdout.write(`${VERSION}\n`)
    return
  }

  const options = parsed.options
  const controller = new RunController(options)

  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    const exitCode = await runHeadless(controller)
    process.exit(exitCode)
    return
  }

  const { waitUntilExit } = render(<Dashboard controller={controller} />, { exitOnCtrlC: false })
  await waitUntilExit()
  const finalState = controller.getState()
  process.exit(finalState.exitCode ?? 0)
}

function parseArgs(argv: string[]): ParseResult {
  let cwd = process.cwd()
  let historyEnabled = true
  let historyFilePath: string | undefined
  let runner: RunnerMode = 'auto'
  let index = 0

  while (index < argv.length) {
    const token = argv[index]
    if (!token) {
      index += 1
      continue
    }

    if (token === '--') {
      return {
        kind: 'run',
        options: {
          cwd,
          historyEnabled,
          historyFilePath,
          runner,
          playwrightArgs: argv.slice(index + 1),
        },
      }
    }

    if (token === '-h' || token === '--help') {
      return { kind: 'help' }
    }

    if (token === '-v' || token === '--version') {
      return { kind: 'version' }
    }

    if (token === '-C' || token === '--cwd') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --cwd')
      }
      cwd = path.resolve(expandHomePath(value))
      index += 2
      continue
    }

    if (token.startsWith('--cwd=')) {
      const value = token.slice('--cwd='.length)
      cwd = path.resolve(expandHomePath(value))
      index += 1
      continue
    }

    if (token === '--history') {
      historyEnabled = true
      index += 1
      continue
    }

    if (token === '--no-history') {
      historyEnabled = false
      index += 1
      continue
    }

    if (token === '--history-file') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --history-file')
      }
      historyFilePath = path.resolve(expandHomePath(value))
      index += 2
      continue
    }

    if (token.startsWith('--history-file=')) {
      const value = token.slice('--history-file='.length)
      historyFilePath = path.resolve(expandHomePath(value))
      index += 1
      continue
    }

    if (token === '--runner') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --runner')
      }
      runner = parseRunner(value)
      index += 2
      continue
    }

    if (token.startsWith('--runner=')) {
      const value = token.slice('--runner='.length)
      runner = parseRunner(value)
      index += 1
      continue
    }

    return {
      kind: 'run',
      options: {
        cwd,
        historyEnabled,
        historyFilePath,
        runner,
        playwrightArgs: argv.slice(index),
      },
    }
  }

  return {
    kind: 'run',
    options: {
      cwd,
      historyEnabled,
      historyFilePath,
      runner,
      playwrightArgs: [],
    },
  }
}

async function runHeadless(controller: RunController): Promise<number> {
  let printedHeader = false
  let lastCompleted = -1

  controller.subscribe((state) => {
    if (!printedHeader) {
      process.stdout.write('Playwright TUI (headless mode)\n')
      printedHeader = true
    }

    if (state.completedTests !== lastCompleted) {
      lastCompleted = state.completedTests
      const total = state.totalTests > 0 ? state.totalTests : '?'
      const eta = state.etaMs ? formatDuration(state.etaMs) : '--'
      process.stdout.write(
        `Progress ${state.completedTests}/${total} pass=${state.passed} fail=${state.failed} flaky=${state.flaky} skip=${state.skipped} ETA=${eta}\n`,
      )
    }
  })

  const exitCode = await controller.start()
  const finalState = controller.getState()
  const elapsedMs = finalState.finishedAt
    ? Math.max(0, finalState.finishedAt - finalState.startedAt)
    : Math.max(0, Date.now() - finalState.startedAt)

  process.stdout.write(
    `Done in ${formatDuration(elapsedMs)}. pass=${finalState.passed} fail=${finalState.failed} flaky=${finalState.flaky} skip=${finalState.skipped}\n`,
  )
  return exitCode
}

function parseRunner(raw: string): RunnerMode {
  if (raw === 'auto' || raw === 'bunx' || raw === 'npx') {
    return raw
  }
  throw new Error(`Invalid runner '${raw}'. Use one of: auto, bunx, npx.`)
}

function buildHelpText(): string {
  return [
    'playwright-tui',
    '',
    'Run Playwright tests with a terminal dashboard that tracks per-worker execution,',
    'pass/fail/flaky/skip counts, and ETA using persisted local timing history.',
    'Interactive mode keybinds: r rerun failed, a rerun all, f filter, w watch toggle, s summary, q quit.',
    '',
    'Usage:',
    '  playwright-tui [wrapper options] [playwright args...]',
    '  playwright-tui [wrapper options] -- [playwright args...]',
    '',
    'Wrapper options:',
    '  -C, --cwd <path>            Directory containing playwright.config.* (default: current dir)',
    '  --history / --no-history    Enable/disable persisted ETA history (default: enabled)',
    '  --history-file <path>       Override history path (default: ~/.config/playwright-tui/history.json)',
    '  --runner <auto|bunx|npx>    Command used to invoke Playwright (default: auto)',
    '  -h, --help                  Show help',
    '  -v, --version               Show version',
    '',
    'Examples:',
    '  playwright-tui',
    '  playwright-tui -- --grep @smoke --workers=4',
    '  playwright-tui -C ../my-app tests/login.spec.ts',
    '  playwright-tui --runner npx -- --project=chromium',
    '',
  ].join('\n')
}

function expandHomePath(value: string): string {
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return path.join(homedir(), value.slice(2))
  return value
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Error: ${message}\n`)
  process.exit(1)
})
