'use strict'

const fs = require('node:fs')
const path = require('node:path')

function normalizeTestStatus(status) {
  if (status === 'timedout') return 'timedOut'
  return status
}

function firstLine(value) {
  if (!value) return ''
  const line = String(value).split(/\r?\n/u)[0]
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
      // eslint-disable-next-line global-require, import/no-dynamic-require
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
    const fingerprint = `${project}|${file}|${title}`

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
      fs.appendFileSync(this.eventFile, JSON.stringify(payload) + '\n')
    } catch {
      // Ignore telemetry write failures so tests can continue.
    }
  }
}

module.exports = PlaywrightTuiReporter
