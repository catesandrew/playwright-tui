export type TestStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
export type TestOutcome = 'expected' | 'unexpected' | 'flaky' | 'skipped'
export type RunStatus = 'passed' | 'failed' | 'timedout' | 'interrupted'

export interface FileTotalEventEntry {
  file: string
  total: number
}

export interface RunBeginEvent {
  type: 'run-begin'
  total: number
  workers: number
  startedAt: number
  playwrightVersion?: string
  browserTargets: string[]
  projectTargets: string[]
  fileTotals: FileTotalEventEntry[]
}

export interface TestBeginEvent {
  type: 'test-begin'
  fingerprint: string
  title: string
  file: string
  project: string
  workerIndex: number
  retry: number
  startedAt: number
  expectedStatus: TestStatus
}

export interface TestEndEvent {
  type: 'test-end'
  fingerprint: string
  title: string
  file: string
  project: string
  workerIndex: number
  retry: number
  durationMs: number
  status: TestStatus
  expectedStatus: TestStatus
  outcome: TestOutcome
  isFinal: boolean
  finishedAt: number
  errorMessage?: string
  stack?: string
  expected?: string
  actual?: string
}

export interface RunEndEvent {
  type: 'run-end'
  status: RunStatus
  durationMs: number
  finishedAt: number
}

export interface FatalEvent {
  type: 'fatal'
  message: string
  at?: number
}

export type ReporterEvent = RunBeginEvent | TestBeginEvent | TestEndEvent | RunEndEvent | FatalEvent

export interface WorkerViewState {
  workerIndex: number
  title: string | null
  project: string | null
  file: string | null
  retry: number
  startedAt: number | null
}

export interface FileProgressViewState {
  file: string
  total: number
  completed: number
  passed: number
  failed: number
  skipped: number
  flaky: number
  running: number
}

export interface FailureViewState {
  title: string
  project: string
  file: string
  status: TestStatus
  retry: number
  message: string
  expected?: string
  actual?: string
  stack?: string
  durationMs: number
  at: number
}

export interface ActivityViewState {
  title: string
  file: string
  project: string
  status: TestStatus | 'flaky'
  durationMs: number
  retry: number
  at: number
}

export interface SlowTestViewState {
  title: string
  file: string
  project: string
  durationMs: number
}

export interface OutputLine {
  source: 'stdout' | 'stderr' | 'system'
  text: string
  at: number
}

export type RunPhase = 'initializing' | 'running' | 'finished' | 'error'

export interface RunState {
  runIndex: number
  phase: RunPhase
  receivedRunBegin: boolean
  statusText: string
  command: string
  playwrightVersion: string | null
  browserTargets: string[]
  projectTargets: string[]
  watchMode: boolean
  startedAt: number
  finishedAt: number | null
  totalTests: number
  completedTests: number
  passed: number
  failed: number
  flaky: number
  skipped: number
  retryCount: number
  timedOut: number
  interrupted: number
  workersConfigured: number
  workers: WorkerViewState[]
  fileProgress: FileProgressViewState[]
  recentActivity: ActivityViewState[]
  slowestTests: SlowTestViewState[]
  failedTests: FailureViewState[]
  etaMs: number | null
  recentFailures: FailureViewState[]
  recentOutput: OutputLine[]
  historyEnabled: boolean
  historyPath: string | null
  exitCode: number | null
}
