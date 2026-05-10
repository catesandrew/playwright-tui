import { homedir } from 'node:os'
import path from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'

interface TimingEntry {
  avgMs: number
  runs: number
  lastMs: number
  updatedAt: string
}

interface TimingHistoryDocument {
  version: 1
  updatedAt: string
  tests: Record<string, TimingEntry>
}

interface TimingHistoryStoreOptions {
  enabled: boolean
  filePath: string | undefined
}

const HISTORY_VERSION = 1 as const
const DEFAULT_FALLBACK_MS = 2_000
const MAX_TRACKED_RUNS = 50

export function getDefaultHistoryPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME
  if (xdgConfigHome && xdgConfigHome.trim().length > 0) {
    return path.join(xdgConfigHome, 'playwright-tui', 'history.json')
  }
  return path.join(homedir(), '.config', 'playwright-tui', 'history.json')
}

export class TimingHistoryStore {
  private readonly enabled: boolean
  private readonly filePath: string
  private tests: Record<string, TimingEntry> = {}

  constructor(options: TimingHistoryStoreOptions) {
    this.enabled = options.enabled
    this.filePath = options.filePath ?? getDefaultHistoryPath()
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  get resolvedPath(): string {
    return this.filePath
  }

  async load(): Promise<void> {
    if (!this.enabled) return
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<TimingHistoryDocument>
      if (parsed.version !== HISTORY_VERSION || !parsed.tests || typeof parsed.tests !== 'object') {
        return
      }
      this.tests = parsed.tests
    } catch {
      // Missing/corrupt history is non-fatal.
    }
  }

  getEstimateMs(fingerprint: string): number | undefined {
    if (!this.enabled) return undefined
    const entry = this.tests[fingerprint]
    if (!entry) return undefined
    if (!Number.isFinite(entry.avgMs) || entry.avgMs <= 0) return undefined
    return entry.avgMs
  }

  getFallbackEstimateMs(): number {
    if (!this.enabled) return DEFAULT_FALLBACK_MS
    const values = Object.values(this.tests)
      .map((entry) => entry.avgMs)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b)
    if (values.length === 0) {
      return DEFAULT_FALLBACK_MS
    }
    const middle = Math.floor(values.length / 2)
    const median = values[middle] ?? DEFAULT_FALLBACK_MS
    return clampMs(median)
  }

  recordDuration(fingerprint: string, durationMs: number): void {
    if (!this.enabled) return
    const normalizedDuration = clampMs(durationMs)
    const now = new Date().toISOString()
    const current = this.tests[fingerprint]
    if (!current) {
      this.tests[fingerprint] = {
        avgMs: normalizedDuration,
        runs: 1,
        lastMs: normalizedDuration,
        updatedAt: now,
      }
      return
    }

    const nextRuns = Math.min(MAX_TRACKED_RUNS, current.runs + 1)
    const nextAvgMs =
      current.runs >= MAX_TRACKED_RUNS
        ? current.avgMs * 0.96 + normalizedDuration * 0.04
        : (current.avgMs * current.runs + normalizedDuration) / (current.runs + 1)

    this.tests[fingerprint] = {
      avgMs: clampMs(nextAvgMs),
      runs: nextRuns,
      lastMs: normalizedDuration,
      updatedAt: now,
    }
  }

  async save(): Promise<void> {
    if (!this.enabled) return
    const directory = path.dirname(this.filePath)
    const tempFilePath = `${this.filePath}.${process.pid}.tmp`
    const payload: TimingHistoryDocument = {
      version: HISTORY_VERSION,
      updatedAt: new Date().toISOString(),
      tests: this.tests,
    }

    await mkdir(directory, { recursive: true })
    await writeFile(tempFilePath, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    await rename(tempFilePath, this.filePath)
  }
}

function clampMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_FALLBACK_MS
  return Math.min(600_000, Math.max(100, Math.round(value)))
}
