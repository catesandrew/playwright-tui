import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { TimingHistoryStore } from '../history/timingHistoryStore.js'
import type {
  ActivityViewState,
  FailureViewState,
  FileProgressViewState,
  OutputLine,
  ReporterEvent,
  RunState,
  SlowTestViewState,
  TestBeginEvent,
  TestEndEvent,
  WorkerViewState,
} from '../types.js'

export type RunnerMode = 'auto' | 'bunx' | 'npx'
type RunMode = 'all' | 'failed'

export interface RunControllerOptions {
  cwd: string
  historyEnabled: boolean
  historyFilePath: string | undefined
  runner: RunnerMode
  playwrightArgs: string[]
}

interface TrackedTest {
  fingerprint: string
  project: string
  file: string
  title: string
  predictedMs: number
  totalDurationMs: number
  finalized: boolean
}

const MAX_OUTPUT_LINES = 6
const MAX_ACTIVITY_LINES = 80
const MAX_FAILURES = 60
const MAX_RECENT_FAILURES = 10
const MAX_SLOWEST_TESTS = 10
const FALLBACK_WORKER_COUNT = 1
const FALLBACK_REPORTER_SOURCE = `'use strict'

const fs = require('node:fs')
const path = require('node:path')

function normalizeTestStatus(status) {
  if (status === 'timedout') return 'timedOut'
  return status
}

function firstLine(value) {
  if (!value) return ''
  const line = String(value).split(/\\r?\\n/u)[0]
  return line ?? ''
}

function toShortText(value) {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

function resolvePlaywrightVersion() {
  const candidates = ['@playwright/test/package.json', 'playwright/package.json']
  for (const candidate of candidates) {
    try {
      const pkg = require(candidate)
      if (pkg && typeof pkg.version === 'string') return pkg.version
    } catch {
      // Try next package.
    }
  }
  return undefined
}

class PlaywrightTuiReporter {
  constructor() {
    const file = process.env.PWTUI_EVENTS_FILE
    this.eventFile = typeof file === 'string' && file.trim().length > 0 ? file : null
  }

  printsToStdio() {
    return false
  }

  onBegin(config, suite) {
    const parsedWorkers = Number.parseInt(String(config.workers ?? 1), 10)
    const workers = Number.isFinite(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 1
    const tests = suite.allTests()
    const total = tests.length
    const fileTotals = Array.from(
      tests.reduce((map, test) => {
        const rawFile = test.location?.file ? String(test.location.file) : '<unknown-file>'
        const file = path.relative(process.cwd(), rawFile) || rawFile
        map.set(file, (map.get(file) ?? 0) + 1)
        return map
      }, new Map()).entries(),
    )
      .map(([file, fileTotal]) => ({ file, total: fileTotal }))
      .sort((left, right) => left.file.localeCompare(right.file))

    const projects = Array.isArray(config.projects) ? config.projects : []
    const projectTargets = projects
      .map((project) => String(project?.name ?? '').trim())
      .filter((value) => value.length > 0)

    const browserTargets = Array.from(
      new Set(
        projects
          .map((project) => {
            const browserName = project?.use?.browserName
            return typeof browserName === 'string' ? browserName : undefined
          })
          .filter(Boolean),
      ),
    )

    const playwrightVersion = resolvePlaywrightVersion()

    this.emit({
      type: 'run-begin',
      workers,
      total,
      startedAt: Date.now(),
      playwrightVersion,
      browserTargets,
      projectTargets,
      fileTotals,
    })
  }

  onTestBegin(test, result) {
    const details = this.describeTest(test)
    this.emit({
      type: 'test-begin',
      ...details,
      workerIndex: result.workerIndex,
      retry: result.retry,
      startedAt: Date.now(),
      expectedStatus: normalizeTestStatus(test.expectedStatus),
    })
  }

  onTestEnd(test, result) {
    const details = this.describeTest(test)
    const expectedStatus = normalizeTestStatus(test.expectedStatus)
    const status = normalizeTestStatus(result.status)
    const matchesExpected = status === expectedStatus
    const retries = typeof test.retries === 'number' ? test.retries : 0
    const hasRetriesLeft = result.retry < retries
    const isFinal = matchesExpected || !hasRetriesLeft
    const outcome = typeof test.outcome === 'function' ? test.outcome() : 'expected'
    const primaryError = result.error ?? result.errors?.[0]
    const matcherResult = primaryError?.matcherResult
    const errorMessage =
      firstLine(primaryError?.message) || firstLine(primaryError?.stack) || firstLine(result.errors?.[0]?.message)
    const stack = primaryError?.stack ? String(primaryError.stack) : undefined
    const expected = toShortText(primaryError?.expected ?? matcherResult?.expected)
    const actual = toShortText(primaryError?.actual ?? matcherResult?.actual)

    this.emit({
      type: 'test-end',
      ...details,
      workerIndex: result.workerIndex,
      retry: result.retry,
      durationMs: result.duration,
      status,
      expectedStatus,
      outcome,
      isFinal,
      finishedAt: Date.now(),
      errorMessage,
      stack,
      expected,
      actual,
    })
  }

  onError(error) {
    this.emit({
      type: 'fatal',
      message: firstLine(error?.stack) || firstLine(error?.message) || 'Unknown Playwright error',
      at: Date.now(),
    })
  }

  onEnd(result) {
    this.emit({
      type: 'run-end',
      status: result.status,
      durationMs: result.duration,
      finishedAt: Date.now(),
    })
  }

  describeTest(test) {
    const titlePath = typeof test.titlePath === 'function' ? test.titlePath() : [test.title]
    const safeTitlePath = Array.isArray(titlePath) ? titlePath.map((part) => String(part)) : []
    const project = safeTitlePath[0] ?? 'default'
    const title = safeTitlePath.slice(1).join(' > ') || String(test.title || '<untitled>')
    const rawFile = test.location?.file ? String(test.location.file) : '<unknown-file>'
    const file = path.relative(process.cwd(), rawFile) || rawFile
    const fingerprint = \`\${project}|\${file}|\${title}\`

    return {
      fingerprint,
      project,
      file,
      title,
    }
  }

  emit(payload) {
    if (this.eventFile === null) return
    try {
      fs.appendFileSync(this.eventFile, JSON.stringify(payload) + '\\n')
    } catch {
      // Ignore telemetry write failures so tests can continue.
    }
  }
}

module.exports = PlaywrightTuiReporter
`

export class RunController {
  private readonly options: RunControllerOptions
  private readonly historyStore: TimingHistoryStore
  private readonly listeners = new Set<(state: RunState) => void>()
  private readonly trackedTests = new Map<string, TrackedTest>()
  private readonly fileProgressMap = new Map<string, FileProgressViewState>()
  private readonly fileFingerprintSet = new Map<string, Set<string>>()
  private readonly slowestTestsMap = new Map<string, SlowTestViewState>()
  private child: ReturnType<typeof spawn> | undefined
  private stopEventReader: (() => void) | null = null
  private state: RunState
  private fallbackEstimateMs = 2_000
  private totalPredictedMs = 0
  private completedPredictedMs = 0
  private stopRequested = false
  private runningPromise: Promise<number> | null = null
  private historyLoaded = false
  private lastRunHadFailures = false

  constructor(options: RunControllerOptions) {
    this.options = options
    this.historyStore = new TimingHistoryStore({
      enabled: options.historyEnabled,
      filePath: options.historyFilePath,
    })
    this.state = createInitialState(this.historyStore)
  }

  getState(): RunState {
    return this.snapshot()
  }

  subscribe(listener: (state: RunState) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  isRunning(): boolean {
    return this.state.phase === 'running' || this.state.phase === 'initializing'
  }

  async start(): Promise<number> {
    return this.startRun('all')
  }

  async rerunAll(): Promise<number | null> {
    if (this.isRunning()) {
      this.pushOutput('system', 'Run is already active.')
      this.emit()
      return null
    }
    return this.startRun('all')
  }

  async rerunFailed(): Promise<number | null> {
    if (this.isRunning()) {
      this.pushOutput('system', 'Run is already active.')
      this.emit()
      return null
    }
    if (!this.lastRunHadFailures) {
      this.pushOutput('system', 'No failed tests available for rerun.')
      this.emit()
      return null
    }
    return this.startRun('failed')
  }

  toggleWatchMode(): boolean {
    this.state.watchMode = !this.state.watchMode
    this.pushOutput('system', `Watch mode ${this.state.watchMode ? 'enabled' : 'disabled'} for next run.`)
    this.emit()
    return this.state.watchMode
  }

  requestStop(): void {
    this.stopRequested = true
    if (!this.child || this.child.killed) {
      return
    }
    this.pushOutput('system', 'Stopping Playwright run (SIGINT)...')
    this.state.statusText = 'Stopping run...'
    this.emit()
    this.child.kill('SIGINT')
  }

  private async startRun(mode: RunMode): Promise<number> {
    if (this.runningPromise) {
      return this.runningPromise
    }

    const runPromise = this.executeRun(mode).finally(() => {
      this.runningPromise = null
      this.child = undefined
    })
    this.runningPromise = runPromise
    return runPromise
  }

  private async executeRun(mode: RunMode): Promise<number> {
    try {
      this.validatePlaywrightArgs(this.options.playwrightArgs)
      if (!this.historyLoaded) {
        await this.historyStore.load()
        this.historyLoaded = true
      }

      this.fallbackEstimateMs = this.historyStore.getFallbackEstimateMs()
      this.resetForRun(mode)

      const runner = this.resolveRunner(this.options.runner)
      const reporterRuntime = this.resolveReporterRuntime()
      const eventFilePath = this.createEventFilePath()
      const args = [
        'playwright',
        'test',
        ...this.buildPlaywrightArgs(mode),
        `--reporter=${reporterRuntime.path}`,
      ]

      this.state.command = [runner, ...args].join(' ')
      this.state.phase = 'running'
      this.state.statusText = mode === 'failed' ? 'Rerunning failed tests...' : 'Running tests...'
      this.emit()

      const child = spawn(runner, args, {
        cwd: this.options.cwd,
        env: {
          ...process.env,
          PWTUI_EVENTS_FILE: eventFilePath,
        },
        stdio: ['inherit', 'pipe', 'pipe'],
      })
      this.child = child
      this.attachOutputReaders(child)
      this.stopEventReader = this.attachEventFileReader(eventFilePath)

      return await new Promise<number>((resolve) => {
        child.on('error', (error) => {
          this.stopEventReader?.()
          this.stopEventReader = null
          this.cleanupEventFile(eventFilePath)
          reporterRuntime.cleanup()
          this.state.phase = 'error'
          this.state.statusText = 'Failed to start Playwright process'
          this.pushOutput('stderr', error.message)
          this.state.finishedAt = Date.now()
          this.state.exitCode = 1
          this.emit()
          resolve(1)
        })

        child.on('close', async (code, signal) => {
          this.stopEventReader?.()
          this.stopEventReader = null
          this.cleanupEventFile(eventFilePath)
          reporterRuntime.cleanup()
          await this.finishHistory()
          this.state.finishedAt = this.state.finishedAt ?? Date.now()
          this.state.etaMs = null

          const exitCode = code ?? (signal ? 1 : 0)
          this.state.exitCode = exitCode
          if (this.state.phase !== 'error') {
            this.state.phase = 'finished'
          }

          if (this.stopRequested) {
            this.state.statusText = `Run stopped (${signal ?? `code ${exitCode}`})`
          } else if (exitCode === 0) {
            this.state.statusText = 'Run complete'
          } else {
            this.state.statusText = `Run failed (exit ${exitCode})`
          }
          this.lastRunHadFailures = this.state.failed > 0
          this.emit()
          resolve(exitCode)
        })
      })
    } catch (error) {
      this.state.phase = 'error'
      this.state.statusText = 'Failed to initialize'
      this.state.finishedAt = Date.now()
      this.state.exitCode = 1
      this.pushOutput('stderr', error instanceof Error ? error.message : String(error))
      this.emit()
      return 1
    }
  }

  private resetForRun(mode: RunMode): void {
    this.stopRequested = false
    this.trackedTests.clear()
    this.fileProgressMap.clear()
    this.fileFingerprintSet.clear()
    this.slowestTestsMap.clear()
    this.totalPredictedMs = 0
    this.completedPredictedMs = 0

    this.state.runIndex += 1
    this.state.phase = 'initializing'
    this.state.receivedRunBegin = false
    this.state.startedAt = Date.now()
    this.state.finishedAt = null
    this.state.statusText = mode === 'failed' ? 'Preparing failed-test rerun...' : 'Preparing Playwright run...'
    this.state.command = ''
    this.state.totalTests = 0
    this.state.completedTests = 0
    this.state.passed = 0
    this.state.failed = 0
    this.state.flaky = 0
    this.state.skipped = 0
    this.state.retryCount = 0
    this.state.timedOut = 0
    this.state.interrupted = 0
    this.state.workersConfigured = 0
    this.state.workers = []
    this.state.fileProgress = []
    this.state.recentActivity = []
    this.state.slowestTests = []
    this.state.failedTests = []
    this.state.recentFailures = []
    this.state.recentOutput = []
    this.state.etaMs = null
    this.state.exitCode = null
  }

  private buildPlaywrightArgs(mode: RunMode): string[] {
    const withoutReporter = this.options.playwrightArgs.filter(
      (arg) => arg !== '--reporter' && arg !== '-r' && !arg.startsWith('--reporter='),
    )
    const withoutLastFailed = withoutReporter.filter(
      (arg) => arg !== '--last-failed' && !arg.startsWith('--last-failed='),
    )
    const args = [...withoutLastFailed]
    if (mode === 'failed') {
      args.push('--last-failed')
    }
    if (this.state.watchMode && !args.includes('--watch')) {
      args.push('--watch')
    }
    return args
  }

  private attachOutputReaders(child: ReturnType<typeof spawn>): void {
    if (child.stdout) {
      const stdoutLines = readline.createInterface({ input: child.stdout })
      stdoutLines.on('line', (line) => {
        if (line.trim().length > 0) {
          this.pushOutput('stdout', line)
          this.updateStartupStatusFromOutput(line)
        }
      })
    }

    if (child.stderr) {
      const stderrLines = readline.createInterface({ input: child.stderr })
      stderrLines.on('line', (line) => {
        if (line.trim().length > 0) {
          this.pushOutput('stderr', line)
          this.updateStartupStatusFromOutput(line)
        }
      })
    }
  }

  private attachEventFileReader(eventFilePath: string): () => void {
    let readOffset = 0
    let pending = ''
    let disposed = false

    const readNewEvents = (): void => {
      if (disposed) return
      if (!fs.existsSync(eventFilePath)) return

      let contents: string
      try {
        contents = fs.readFileSync(eventFilePath, 'utf8')
      } catch {
        return
      }

      if (contents.length < readOffset) {
        readOffset = 0
        pending = ''
      }
      if (contents.length === readOffset) {
        return
      }

      const chunk = contents.slice(readOffset)
      readOffset = contents.length
      const merged = pending + chunk
      const lines = merged.split(/\r?\n/u)
      pending = lines.pop() ?? ''

      for (const line of lines) {
        this.handleReporterEventLine(line)
      }
    }

    const pollTimer = setInterval(readNewEvents, 120)
    if (typeof pollTimer.unref === 'function') {
      pollTimer.unref()
    }
    readNewEvents()

    return () => {
      disposed = true
      clearInterval(pollTimer)
      readNewEvents()
      if (pending.trim()) {
        this.handleReporterEventLine(pending)
      }
      pending = ''
    }
  }

  private handleReporterEventLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return

    try {
      const parsed = JSON.parse(trimmed) as ReporterEvent
      this.handleReporterEvent(parsed)
    } catch {
      this.pushOutput('stderr', `Malformed reporter event: ${trimmed}`)
    }
  }

  private handleReporterEvent(event: ReporterEvent): void {
    switch (event.type) {
      case 'run-begin': {
        this.state.receivedRunBegin = true
        this.state.startedAt = event.startedAt
        this.state.totalTests = event.total
        this.state.workersConfigured = Math.max(FALLBACK_WORKER_COUNT, event.workers)
        this.state.workers = Array.from({ length: this.state.workersConfigured }, (_, index) =>
          createWorkerSlot(index),
        )
        this.state.playwrightVersion = event.playwrightVersion ?? this.state.playwrightVersion
        this.state.browserTargets = event.browserTargets
        this.state.projectTargets = event.projectTargets
        this.initializeFileProgress(event.fileTotals)
        this.totalPredictedMs = this.state.totalTests * this.fallbackEstimateMs
        this.completedPredictedMs = 0
        this.state.statusText = 'Running tests...'
        this.updateEta()
        this.emit()
        return
      }

      case 'test-begin': {
        this.ensureTrackedTest(event)
        this.state.retryCount += event.retry > 0 ? 1 : 0
        this.setWorkerActive(event)
        this.adjustFileProgress(event.file, (entry) => {
          entry.running += 1
        })
        this.state.statusText = `Running: ${event.title}`
        this.updateEta()
        this.emit()
        return
      }

      case 'test-end': {
        this.ensureTrackedTest(event)
        this.clearWorker(event.workerIndex, event.fingerprint)
        this.adjustFileProgress(event.file, (entry) => {
          entry.running = Math.max(0, entry.running - 1)
        })
        this.finalizeTrackedTest(event)
        this.updateEta()
        this.emit()
        return
      }

      case 'run-end': {
        this.state.finishedAt = event.finishedAt
        this.state.statusText = `Playwright status: ${event.status}`
        this.state.etaMs = null
        this.emit()
        return
      }

      case 'fatal': {
        this.pushOutput('stderr', event.message)
        this.state.statusText = event.message
        this.emit()
        return
      }
    }
  }

  private initializeFileProgress(fileTotals: Array<{ file: string; total: number }>): void {
    this.fileProgressMap.clear()
    this.fileFingerprintSet.clear()
    for (const fileTotal of fileTotals) {
      this.fileProgressMap.set(fileTotal.file, {
        file: fileTotal.file,
        total: Math.max(0, fileTotal.total),
        completed: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0,
        running: 0,
      })
    }
    this.syncFileProgress()
  }

  private ensureTrackedTest(event: TestBeginEvent | TestEndEvent): TrackedTest {
    const existing = this.trackedTests.get(event.fingerprint)
    if (existing) {
      return existing
    }

    const predictedMs = this.historyStore.getEstimateMs(event.fingerprint) ?? this.fallbackEstimateMs
    this.totalPredictedMs += predictedMs - this.fallbackEstimateMs

    const tracked: TrackedTest = {
      fingerprint: event.fingerprint,
      project: event.project,
      file: event.file,
      title: event.title,
      predictedMs,
      totalDurationMs: 0,
      finalized: false,
    }
    this.trackedTests.set(event.fingerprint, tracked)

    this.adjustFileProgress(event.file, (entry) => {
      const known = this.fileFingerprintSet.get(event.file) ?? new Set<string>()
      known.add(event.fingerprint)
      this.fileFingerprintSet.set(event.file, known)
      entry.total = Math.max(entry.total, known.size)
    })

    return tracked
  }

  private finalizeTrackedTest(event: TestEndEvent): void {
    const tracked = this.trackedTests.get(event.fingerprint)
    if (!tracked) return

    tracked.totalDurationMs += event.durationMs
    if (!event.isFinal || tracked.finalized) {
      return
    }

    tracked.finalized = true
    this.state.completedTests += 1
    this.completedPredictedMs += tracked.predictedMs
    this.historyStore.recordDuration(tracked.fingerprint, tracked.totalDurationMs)

    if (event.status === 'timedOut') this.state.timedOut += 1
    if (event.status === 'interrupted') this.state.interrupted += 1

    this.adjustFileProgress(event.file, (entry) => {
      entry.completed += 1
    })

    switch (event.outcome) {
      case 'expected': {
        if (event.status === 'skipped' || event.expectedStatus === 'skipped') {
          this.state.skipped += 1
          this.adjustFileProgress(event.file, (entry) => {
            entry.skipped += 1
          })
        } else {
          this.state.passed += 1
          this.adjustFileProgress(event.file, (entry) => {
            entry.passed += 1
          })
        }
        break
      }
      case 'flaky': {
        this.state.flaky += 1
        this.adjustFileProgress(event.file, (entry) => {
          entry.flaky += 1
        })
        break
      }
      case 'skipped': {
        this.state.skipped += 1
        this.adjustFileProgress(event.file, (entry) => {
          entry.skipped += 1
        })
        break
      }
      case 'unexpected':
      default: {
        this.state.failed += 1
        this.adjustFileProgress(event.file, (entry) => {
          entry.failed += 1
        })
        this.addFailure(event)
        break
      }
    }

    this.addActivity(event)
    this.updateSlowestTests(tracked)
  }

  private addActivity(event: TestEndEvent): void {
    const activity: ActivityViewState = {
      title: event.title,
      file: event.file,
      project: event.project,
      status: event.outcome === 'flaky' ? 'flaky' : event.status,
      durationMs: event.durationMs,
      retry: event.retry,
      at: event.finishedAt,
    }
    this.state.recentActivity = [activity, ...this.state.recentActivity].slice(0, MAX_ACTIVITY_LINES)
  }

  private addFailure(event: TestEndEvent): void {
    const failure: FailureViewState = {
      title: event.title,
      project: event.project,
      file: event.file,
      status: event.status,
      retry: event.retry,
      message: event.errorMessage?.trim() || 'Test failed without an explicit error message',
      durationMs: event.durationMs,
      at: event.finishedAt,
    }
    const expected = event.expected?.trim()
    const actual = event.actual?.trim()
    if (expected) {
      failure.expected = expected
    }
    if (actual) {
      failure.actual = actual
    }
    if (event.stack) {
      failure.stack = event.stack
    }

    this.state.failedTests = [failure, ...this.state.failedTests].slice(0, MAX_FAILURES)
    this.state.recentFailures = [failure, ...this.state.recentFailures].slice(0, MAX_RECENT_FAILURES)
  }

  private updateSlowestTests(test: TrackedTest): void {
    const key = `${test.project}|${test.file}|${test.title}`
    const previous = this.slowestTestsMap.get(key)
    const nextDuration = previous ? Math.max(previous.durationMs, test.totalDurationMs) : test.totalDurationMs
    this.slowestTestsMap.set(key, {
      title: test.title,
      file: test.file,
      project: test.project,
      durationMs: nextDuration,
    })

    this.state.slowestTests = Array.from(this.slowestTestsMap.values())
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, MAX_SLOWEST_TESTS)
  }

  private setWorkerActive(event: TestBeginEvent): void {
    this.ensureWorkerSlot(event.workerIndex)
    const worker = this.state.workers[event.workerIndex]
    if (!worker) return
    worker.title = event.title
    worker.project = event.project
    worker.file = event.file
    worker.retry = event.retry
    worker.startedAt = event.startedAt
  }

  private clearWorker(workerIndex: number, expectedFingerprint: string): void {
    const worker = this.state.workers[workerIndex]
    if (!worker || worker.title === null) return

    const currentFingerprint = `${worker.project ?? 'default'}|${worker.file ?? '<unknown-file>'}|${worker.title}`
    if (currentFingerprint !== expectedFingerprint) {
      return
    }
    this.state.workers[workerIndex] = createWorkerSlot(workerIndex)
  }

  private ensureWorkerSlot(workerIndex: number): void {
    if (workerIndex < 0) return
    while (this.state.workers.length <= workerIndex) {
      this.state.workers.push(createWorkerSlot(this.state.workers.length))
    }
    this.state.workersConfigured = Math.max(this.state.workersConfigured, this.state.workers.length)
  }

  private adjustFileProgress(file: string, updater: (entry: FileProgressViewState) => void): void {
    const existing = this.fileProgressMap.get(file)
    const entry =
      existing ??
      ({
        file,
        total: 0,
        completed: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0,
        running: 0,
      } as FileProgressViewState)
    updater(entry)
    this.fileProgressMap.set(file, entry)
    this.syncFileProgress()
  }

  private syncFileProgress(): void {
    this.state.fileProgress = Array.from(this.fileProgressMap.values()).sort((left, right) =>
      left.file.localeCompare(right.file),
    )
  }

  private updateEta(): void {
    if (this.state.phase !== 'running') {
      this.state.etaMs = null
      return
    }

    if (this.state.totalTests <= 0) {
      this.state.etaMs = null
      return
    }

    const elapsed = Date.now() - this.state.startedAt
    const progressByPrediction =
      this.totalPredictedMs > 0 ? this.completedPredictedMs / this.totalPredictedMs : 0
    const progressByCount = this.state.completedTests / this.state.totalTests
    const progress = Math.max(progressByPrediction, progressByCount)

    if (!Number.isFinite(progress) || progress <= 0.01 || progress >= 1) {
      this.state.etaMs = null
      return
    }

    this.state.etaMs = Math.max(0, Math.round(elapsed * ((1 - progress) / progress)))
  }

  private async finishHistory(): Promise<void> {
    try {
      await this.historyStore.save()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.pushOutput('stderr', `Failed to save history: ${message}`)
    }
  }

  private validatePlaywrightArgs(args: string[]): void {
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]
      if (!arg) continue
      if (arg === '--reporter' || arg === '-r' || arg.startsWith('--reporter=')) {
        throw new Error('Do not pass --reporter when using playwright-tui; the TUI injects its own reporter.')
      }
    }
  }

  private resolveRunner(mode: RunnerMode): 'bunx' | 'npx' {
    if (mode === 'bunx' || mode === 'npx') {
      if (!commandExists(mode)) {
        throw new Error(`'${mode}' is not available in PATH.`)
      }
      return mode
    }

    if (commandExists('bunx')) return 'bunx'
    if (commandExists('npx')) return 'npx'
    throw new Error("Neither 'bunx' nor 'npx' is available in PATH.")
  }

  private resolveReporterRuntime(): { path: string; cleanup: () => void } {
    const envReporterPath = process.env.PWTUI_REPORTER_PATH?.trim()
    if (envReporterPath && fs.existsSync(envReporterPath)) {
      return { path: envReporterPath, cleanup: () => {} }
    }

    const controllerFilePath = fileURLToPath(import.meta.url)
    const controllerDirectory = path.dirname(controllerFilePath)
    const reporterPath = path.resolve(controllerDirectory, '../../reporter/playwrightTuiReporter.cjs')
    if (fs.existsSync(reporterPath)) {
      return { path: reporterPath, cleanup: () => {} }
    }

    const fallbackPath = path.join(
      os.tmpdir(),
      `pwtui-reporter-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`,
    )
    fs.writeFileSync(fallbackPath, FALLBACK_REPORTER_SOURCE, 'utf8')
    return {
      path: fallbackPath,
      cleanup: () => {
        try {
          fs.unlinkSync(fallbackPath)
        } catch {
          // Ignore cleanup failures.
        }
      },
    }
  }

  private createEventFilePath(): string {
    const fileName = `pwtui-events-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`
    return path.join(os.tmpdir(), fileName)
  }

  private cleanupEventFile(filePath: string): void {
    try {
      fs.unlinkSync(filePath)
    } catch {
      // Ignore cleanup failures.
    }
  }

  private pushOutput(source: OutputLine['source'], text: string): void {
    const normalizedText = stripAnsi(text).trim()
    if (!normalizedText) return
    const nextLine: OutputLine = {
      source,
      text: normalizedText,
      at: Date.now(),
    }
    this.state.recentOutput = [nextLine, ...this.state.recentOutput].slice(0, MAX_OUTPUT_LINES)
  }

  private updateStartupStatusFromOutput(line: string): void {
    if (this.state.phase !== 'running' || this.state.receivedRunBegin) {
      return
    }

    const compact = stripAnsi(line).replace(/\s+/gu, ' ').trim()
    if (!compact) {
      return
    }

    const lower = compact.toLowerCase()
    const nextStatus = /(waiting|another|already|lock|in use)/u.test(lower)
      ? 'Waiting on Playwright startup (another run may be active)...'
      : `Playwright startup: ${compact}`

    if (nextStatus !== this.state.statusText) {
      this.state.statusText = nextStatus
      this.emit()
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private snapshot(): RunState {
    return {
      ...this.state,
      browserTargets: [...this.state.browserTargets],
      projectTargets: [...this.state.projectTargets],
      workers: this.state.workers.map((worker) => ({ ...worker })),
      fileProgress: this.state.fileProgress.map((entry) => ({ ...entry })),
      recentActivity: this.state.recentActivity.map((entry) => ({ ...entry })),
      slowestTests: this.state.slowestTests.map((entry) => ({ ...entry })),
      failedTests: this.state.failedTests.map((failure) => ({ ...failure })),
      recentFailures: this.state.recentFailures.map((failure) => ({ ...failure })),
      recentOutput: this.state.recentOutput.map((line) => ({ ...line })),
    }
  }
}

function createInitialState(historyStore: TimingHistoryStore): RunState {
  return {
    runIndex: 0,
    phase: 'initializing',
    receivedRunBegin: false,
    statusText: 'Preparing Playwright run...',
    command: '',
    playwrightVersion: null,
    browserTargets: [],
    projectTargets: [],
    watchMode: false,
    startedAt: Date.now(),
    finishedAt: null,
    totalTests: 0,
    completedTests: 0,
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    retryCount: 0,
    timedOut: 0,
    interrupted: 0,
    workersConfigured: 0,
    workers: [],
    fileProgress: [],
    recentActivity: [],
    slowestTests: [],
    failedTests: [],
    etaMs: null,
    recentFailures: [],
    recentOutput: [],
    historyEnabled: historyStore.isEnabled,
    historyPath: historyStore.isEnabled ? historyStore.resolvedPath : null,
    exitCode: null,
  }
}

function createWorkerSlot(workerIndex: number): WorkerViewState {
  return {
    workerIndex,
    title: null,
    project: null,
    file: null,
    retry: 0,
    startedAt: null,
  }
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' })
  return !result.error && result.status === 0
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/gu, '')
}
