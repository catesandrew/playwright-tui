import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { RunController } from '../controller/runController.js'
import type { FailureViewState, FileProgressViewState, RunState } from '../types.js'
import { formatDuration, percent, truncate } from '../utils/format.js'

interface DashboardProps {
  controller: RunController
}

interface FlashState {
  message: string
  color: 'red' | 'green' | 'cyan' | 'yellow'
  expiresAt: number
}

type FocusPanel = 'files' | 'failures'

export function Dashboard({ controller }: DashboardProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()

  const [state, setState] = useState<RunState>(controller.getState())
  const [focusPanel, setFocusPanel] = useState<FocusPanel>('files')
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [selectedFailureIndex, setSelectedFailureIndex] = useState(0)
  const [expandedFailures, setExpandedFailures] = useState<Set<string>>(new Set())
  const [showSummary, setShowSummary] = useState(false)
  const [clockTick, setClockTick] = useState(() => Date.now())
  const [flash, setFlash] = useState<FlashState | null>(null)
  const [filterMode, setFilterMode] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [filterDraft, setFilterDraft] = useState('')
  const [exitAfterStop, setExitAfterStop] = useState(false)

  useEffect(() => controller.subscribe(setState), [controller])

  useEffect(() => {
    void controller.start()
  }, [controller])

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick(Date.now())
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (exitAfterStop && !controller.isRunning()) {
      exit()
    }
  }, [controller, exitAfterStop, exit, state.phase])

  const now = clockTick
  const activeFlash = flash && flash.expiresAt > now ? flash : null
  const filterNeedle = filterText.trim().toLowerCase()

  const filteredFiles = useMemo(() => {
    if (!filterNeedle) return state.fileProgress
    return state.fileProgress.filter((file) => file.file.toLowerCase().includes(filterNeedle))
  }, [filterNeedle, state.fileProgress])

  const filteredActivity = useMemo(() => {
    if (!filterNeedle) return state.recentActivity
    return state.recentActivity.filter(
      (entry) =>
        entry.title.toLowerCase().includes(filterNeedle) ||
        entry.file.toLowerCase().includes(filterNeedle) ||
        entry.project.toLowerCase().includes(filterNeedle),
    )
  }, [filterNeedle, state.recentActivity])

  const filteredFailures = useMemo(() => {
    if (!filterNeedle) return state.failedTests
    return state.failedTests.filter(
      (failure) =>
        failure.title.toLowerCase().includes(filterNeedle) ||
        failure.file.toLowerCase().includes(filterNeedle) ||
        failure.project.toLowerCase().includes(filterNeedle) ||
        failure.message.toLowerCase().includes(filterNeedle),
    )
  }, [filterNeedle, state.failedTests])

  useEffect(() => {
    setSelectedFileIndex((current) => clamp(current, 0, Math.max(0, filteredFiles.length - 1)))
  }, [filteredFiles.length])

  useEffect(() => {
    setSelectedFailureIndex((current) => clamp(current, 0, Math.max(0, filteredFailures.length - 1)))
  }, [filteredFailures.length])

  useInput((input, key) => {
    if (filterMode) {
      if (key.return) {
        setFilterText(filterDraft.trim())
        setFilterMode(false)
        return
      }
      if (key.escape) {
        setFilterMode(false)
        setFilterDraft(filterText)
        return
      }
      if (key.backspace || key.delete) {
        setFilterDraft((value) => value.slice(0, Math.max(0, value.length - 1)))
        return
      }
      if (!key.ctrl && !key.meta && input.length === 1 && input.charCodeAt(0) >= 32) {
        setFilterDraft((value) => value + input)
      }
      return
    }

    if (key.tab) {
      setFocusPanel((panel) => (panel === 'files' ? 'failures' : 'files'))
      return
    }

    if (input === 'q') {
      if (controller.isRunning()) {
        controller.requestStop()
        setExitAfterStop(true)
        setFlashState(setFlash, 'Stopping run...', 'yellow')
      } else {
        exit()
      }
      return
    }

    if (input === 's') {
      setShowSummary((value) => !value)
      return
    }

    if (input === 'w') {
      const next = controller.toggleWatchMode()
      setFlashState(setFlash, `Watch mode ${next ? 'enabled' : 'disabled'}`, next ? 'green' : 'yellow')
      return
    }

    if (input === 'a') {
      if (controller.isRunning()) {
        setFlashState(setFlash, 'Run already in progress', 'yellow')
        return
      }
      setFlashState(setFlash, 'Rerunning all tests', 'cyan')
      void controller.rerunAll()
      return
    }

    if (input === 'r') {
      if (controller.isRunning()) {
        setFlashState(setFlash, 'Run already in progress', 'yellow')
        return
      }
      if (state.failed === 0) {
        setFlashState(setFlash, 'No failed tests to rerun', 'yellow')
        return
      }
      setFlashState(setFlash, `Rerunning ${state.failed} failed test${state.failed === 1 ? '' : 's'}`, 'red')
      void controller.rerunFailed()
      return
    }

    if (input === 'f') {
      setFilterDraft(filterText)
      setFilterMode(true)
      return
    }

    if (key.upArrow || input === 'k') {
      if (focusPanel === 'files') {
        setSelectedFileIndex((index) => clamp(index - 1, 0, Math.max(0, filteredFiles.length - 1)))
      } else {
        setSelectedFailureIndex((index) => clamp(index - 1, 0, Math.max(0, filteredFailures.length - 1)))
      }
      return
    }

    if (key.downArrow || input === 'j') {
      if (focusPanel === 'files') {
        setSelectedFileIndex((index) => clamp(index + 1, 0, Math.max(0, filteredFiles.length - 1)))
      } else {
        setSelectedFailureIndex((index) => clamp(index + 1, 0, Math.max(0, filteredFailures.length - 1)))
      }
      return
    }

    if (key.return && focusPanel === 'failures') {
      const failure = filteredFailures[selectedFailureIndex]
      if (!failure) return
      const failureKey = toFailureKey(failure)
      setExpandedFailures((previous) => {
        const next = new Set(previous)
        if (next.has(failureKey)) {
          next.delete(failureKey)
        } else {
          next.add(failureKey)
        }
        return next
      })
    }
  })

  const columns = stdout?.columns ?? 120
  const rows = stdout?.rows ?? 40
  const elapsedMs = state.finishedAt
    ? Math.max(0, state.finishedAt - state.startedAt)
    : Math.max(0, now - state.startedAt)
  const progress = state.totalTests > 0 ? state.completedTests / state.totalTests : 0
  const barWidth = Math.max(22, Math.min(58, columns - 32))
  const barFilled = Math.round(progress * barWidth)
  const bar = `${'█'.repeat(Math.max(0, barFilled))}${'░'.repeat(Math.max(0, barWidth - barFilled))}`

  const browserTargets = state.browserTargets.length > 0 ? state.browserTargets.join(' + ') : '--'
  const version = state.playwrightVersion ?? '--'
  const statusRunning = state.phase === 'running'
  const waitingForRunBegin = statusRunning && !state.receivedRunBegin
  const latestOutput = state.recentOutput[0]

  const summaryRows = showSummary ? Math.max(7, Math.floor(rows * 0.24)) : 0
  const topRows = 4 + (activeFlash ? 1 : 0) + (filterMode ? 1 : 0) + (waitingForRunBegin ? 1 : 0)
  const footerRows = 3
  const bodyRows = Math.max(12, rows - topRows - footerRows - summaryRows)
  const leftWidth = Math.max(26, Math.floor(columns * 0.23))
  const rightWidth = Math.max(44, columns - leftWidth - 1)

  const leftSpecRows = Math.max(6, Math.floor(bodyRows * 0.58))
  const leftActivityRows = Math.max(5, bodyRows - leftSpecRows)
  const rightWorkersRows = Math.max(6, Math.floor(bodyRows * 0.30))
  const rightFailuresRows = Math.max(6, bodyRows - rightWorkersRows)

  const specVisibleRows = Math.max(1, leftSpecRows - 2)
  const activityVisibleRows = Math.max(1, leftActivityRows - 2)
  const workersVisibleRows = Math.max(1, rightWorkersRows - 3)
  const failuresVisibleRows = Math.max(1, rightFailuresRows - 2)

  const specStart = windowStart(filteredFiles.length, selectedFileIndex, specVisibleRows)
  const failureStart = windowStart(
    filteredFailures.length,
    selectedFailureIndex,
    Math.max(1, Math.floor(failuresVisibleRows / 2)),
  )

  const visibleFiles = filteredFiles.slice(specStart, specStart + specVisibleRows)
  const visibleActivity = filteredActivity.slice(0, activityVisibleRows)
  const visibleWorkers = state.workers.slice(0, workersVisibleRows)
  const visibleFailures = filteredFailures.slice(failureStart)
  const statusLine =
    waitingForRunBegin && !latestOutput
      ? `Waiting for Playwright reporter events... (${formatDuration(Math.max(0, now - state.startedAt))} elapsed)`
      : waitingForRunBegin && latestOutput
        ? `[${latestOutput.source}] ${latestOutput.text}`
        : state.statusText

  return (
    <Box flexDirection="column" height={rows}>
      <HeaderBar
        width={columns}
        version={version}
        browserTargets={browserTargets}
        workers={state.workersConfigured}
        statusRunning={statusRunning}
      />

      <StatsBarLine state={state} elapsedMs={elapsedMs} />

      <ProgressLine
        width={columns}
        progress={progress}
        bar={bar}
        completed={state.completedTests}
        total={state.totalTests}
      />

      <Text color="gray">{line(columns)}</Text>

      {activeFlash ? (
        <Text backgroundColor={activeFlash.color} color="black">
          {truncate(activeFlash.message, columns - 1)}
        </Text>
      ) : null}

      {filterMode ? (
        <Text color="cyan">
          filter {'>'} {filterDraft}
          <Text color="gray"> (enter apply, esc cancel)</Text>
        </Text>
      ) : null}

      {waitingForRunBegin ? (
        <Text color="yellow">
          startup: waiting for first Playwright events
          <Text color="gray"> (another run in this repo can delay startup)</Text>
        </Text>
      ) : null}

      <Box>
        <Box width={leftWidth} flexDirection="column">
          <SectionHeader
            title="SPEC FILES"
            badge={`${filteredFiles.length} files`}
            focus={focusPanel === 'files'}
            width={leftWidth}
          />
          {visibleFiles.length === 0 ? (
            <Text color="gray">no spec files</Text>
          ) : (
            visibleFiles.map((entry, rowIndex) => {
              const absoluteIndex = specStart + rowIndex
              const selected = absoluteIndex === selectedFileIndex
              return (
                <SpecRow
                  key={entry.file}
                  entry={entry}
                  width={leftWidth}
                  selected={selected}
                  focused={focusPanel === 'files'}
                />
              )
            })
          )}
          <BlankLines
            count={Math.max(0, specVisibleRows - (visibleFiles.length === 0 ? 1 : visibleFiles.length))}
          />

          <Text color="gray">{line(leftWidth)}</Text>

          <SectionHeader title="RECENT ACTIVITY" width={leftWidth} />
          {visibleActivity.length === 0 ? (
            <Text color="gray">no completed tests yet</Text>
          ) : (
            visibleActivity.map((entry, index) => (
              <ActivityRow key={`${entry.at}-${index}`} width={leftWidth} entry={entry} />
            ))
          )}
          <BlankLines
            count={Math.max(0, activityVisibleRows - (visibleActivity.length === 0 ? 1 : visibleActivity.length))}
          />
          <BlankLines count={1} />
        </Box>

        <Text color="gray">│</Text>

        <Box width={rightWidth} flexDirection="column">
          <SectionHeader
            title="WORKERS"
            badge={`${state.workers.filter((worker) => worker.title).length} active`}
            width={rightWidth}
          />
          <Text color="gray">
            {truncate('  #  TEST                                              FILE                  TIME', rightWidth)}
          </Text>
          {visibleWorkers.length === 0 ? (
            <Text color="gray">no worker data yet</Text>
          ) : (
            visibleWorkers.map((worker) => (
              <WorkerRow key={worker.workerIndex} worker={worker} width={rightWidth} now={now} />
            ))
          )}
          <BlankLines
            count={Math.max(0, workersVisibleRows - (visibleWorkers.length === 0 ? 1 : visibleWorkers.length))}
          />

          <Text color="gray">{line(rightWidth)}</Text>

          <SectionHeader
            title="FAILURES"
            badge={`${filteredFailures.length} failed`}
            focus={focusPanel === 'failures'}
            width={rightWidth}
          />
          <FailureList
            failures={visibleFailures}
            failureStartIndex={failureStart}
            selectedFailureIndex={selectedFailureIndex}
            focusPanel={focusPanel}
            expandedFailures={expandedFailures}
            rowBudget={failuresVisibleRows}
            width={rightWidth}
          />
          <BlankLines count={1} />
        </Box>
      </Box>

      {showSummary ? (
        <SummaryPanel state={state} width={columns} maxRows={summaryRows} />
      ) : null}

      <Text color="gray">{line(columns)}</Text>
      <KeybindBar
        watchMode={state.watchMode}
        showSummary={showSummary}
        focusPanel={focusPanel}
        hasFilter={filterText.length > 0}
      />
      <Text color="gray">{truncate(statusLine, columns - 1)}</Text>
    </Box>
  )
}

function HeaderBar({
  width,
  version,
  browserTargets,
  workers,
  statusRunning,
}: {
  width: number
  version: string
  browserTargets: string
  workers: number
  statusRunning: boolean
}) {
  const left = `▶ PLAYWRIGHT  v${version}  │  ${browserTargets}  │  ${workers || '--'} workers`
  const right = `${statusRunning ? '● RUNNING' : '○ IDLE'}  │  tests/`
  const leftWidth = Math.max(8, width - right.length - 1)
  return (
    <Text>
      <Text color="greenBright">{truncate(left, leftWidth)}</Text>
      <Text color="gray"> </Text>
      <Text color="gray">{right}</Text>
    </Text>
  )
}

function StatsBarLine({ state, elapsedMs }: { state: RunState; elapsedMs: number }) {
  return (
    <Text>
      TOTAL <Text color="white">{state.totalTests}</Text>  <Text color="greenBright">✓ PASS {state.passed}</Text>  <Text color="redBright">✗ FAIL {state.failed}</Text>{' '}
      <Text color="yellowBright">↷ SKIP {state.skipped}</Text>  <Text color="cyanBright">↻ RETRY {state.retryCount}</Text>
      <Text color="gray">  │  </Text>
      ELAPSED <Text color="white">{formatDuration(elapsedMs)}</Text>
    </Text>
  )
}

function ProgressLine({
  width,
  progress,
  bar,
  completed,
  total,
}: {
  width: number
  progress: number
  bar: string
  completed: number
  total: number
}) {
  const left = `${percent(progress)}`
  const right = `${completed}/${total || '?'}`
  const available = Math.max(1, width - left.length - right.length - 6)
  return (
    <Text>
      {left} <Text color="green">{bar.slice(0, available)}</Text>
      <Text color="gray">{bar.slice(available)}</Text> {right}
    </Text>
  )
}

function SectionHeader({
  title,
  badge,
  focus = false,
  width,
}: {
  title: string
  badge?: string
  focus?: boolean
  width: number
}) {
  const label = badge ? `${title} ${badge}` : title
  return (
    <Text color={focus ? 'cyanBright' : 'gray'}>
      {truncate(label, width)}
    </Text>
  )
}

function SpecRow({
  entry,
  width,
  selected,
  focused,
}: {
  entry: FileProgressViewState
  width: number
  selected: boolean
  focused: boolean
}) {
  const status = fileStatus(entry)
  const icon =
    status === 'failed' ? '✗' : status === 'running' ? '◌' : status === 'passed' ? '✓' : '·'
  const iconColor =
    status === 'failed'
      ? 'redBright'
      : status === 'running'
        ? 'cyanBright'
        : status === 'passed'
          ? 'greenBright'
          : 'yellow'
  const mini = miniBar(entry, 11)
  const score = `${entry.completed}/${entry.total}`
  const labelWidth = Math.max(8, width - 26)
  return (
    <Text inverse={selected && focused}>
      <Text color={selected && focused ? 'black' : iconColor}>{icon}</Text> {truncate(entry.file, labelWidth)}{' '}
      <Text color={selected && focused ? 'black' : 'green'}>{mini.passed}</Text>
      <Text color={selected && focused ? 'black' : 'red'}>{mini.failed}</Text>
      <Text color={selected && focused ? 'black' : 'yellow'}>{mini.skipped}</Text>
      <Text color={selected && focused ? 'black' : entry.running > 0 ? 'cyan' : 'gray'}>{mini.pending}</Text>{' '}
      <Text color={selected && focused ? 'black' : 'white'}>{score}</Text>
    </Text>
  )
}

function ActivityRow({
  width,
  entry,
}: {
  width: number
  entry: RunState['recentActivity'][number]
}) {
  const when = new Date(entry.at).toTimeString().slice(0, 8)
  const symbol = activitySymbol(entry.status)
  const color = activityColor(entry.status)
  const duration = formatCompactDuration(entry.durationMs)
  const name = truncate(entry.title, Math.max(8, width - 20))
  return (
    <Text>
      <Text color="gray">{when}</Text> <Text color={color}>{symbol}</Text> {name}{' '}
      <Text color="gray">{duration}</Text>
    </Text>
  )
}

function WorkerRow({
  worker,
  width,
  now,
}: {
  worker: RunState['workers'][number]
  width: number
  now: number
}) {
  const active = worker.title !== null
  const frame = active ? '◌' : '·'
  const test = worker.title ? truncate(worker.title, Math.max(8, width - 44)) : 'idle'
  const file = worker.file ? truncate(worker.file, 18) : ''
  const duration = worker.startedAt ? formatCompactDuration(Math.max(0, now - worker.startedAt)) : '--'
  return (
    <Text>
      <Text color={active ? 'greenBright' : 'gray'}>{frame}</Text> W{worker.workerIndex}{' '}
      {test}
      <Text color="gray"> {padLeft(file, 18)}</Text>{' '}
      <Text color="yellow">{padLeft(duration, 7)}</Text>
    </Text>
  )
}

function KeybindBar({
  watchMode,
  showSummary,
  focusPanel,
  hasFilter,
}: {
  watchMode: boolean
  showSummary: boolean
  focusPanel: FocusPanel
  hasFilter: boolean
}) {
  const summaryLabel = showSummary ? 'hide summary' : 'show summary'
  return (
    <Text color="gray">
      <Text color="red">[r]</Text> rerun failed │ <Text color="cyan">[a]</Text> rerun all │{' '}
      <Text color="yellow">[f]</Text> filter{hasFilter ? '*' : ''} │ <Text color="green">[w]</Text> watch{' '}
      {watchMode ? 'on' : 'off'} │ <Text color="magentaBright">[s]</Text> {summaryLabel} │ <Text color="white">[q]</Text>{' '}
      quit
      <Text color="gray">  ┆  </Text>
      <Text color="cyan">↑↓</Text> navigate <Text color="gray">│</Text> <Text color="cyan">enter</Text> expand{' '}
      <Text color="gray">│</Text> <Text color="cyan">tab</Text> {focusPanel}
    </Text>
  )
}

function FailureList({
  failures,
  failureStartIndex,
  selectedFailureIndex,
  focusPanel,
  expandedFailures,
  rowBudget,
  width,
}: {
  failures: FailureViewState[]
  failureStartIndex: number
  selectedFailureIndex: number
  focusPanel: FocusPanel
  expandedFailures: Set<string>
  rowBudget: number
  width: number
}) {
  if (failures.length === 0) {
    return (
      <>
        <Text color="gray">no failures</Text>
        <BlankLines count={Math.max(0, rowBudget - 1)} />
      </>
    )
  }

  const rows: React.ReactNode[] = []
  let remainingRows = rowBudget

  for (let index = 0; index < failures.length; index += 1) {
    if (remainingRows <= 0) break
    const failure = failures[index]
    if (!failure) continue

    const absoluteIndex = failureStartIndex + index
    const selected = absoluteIndex === selectedFailureIndex
    const failureKey = toFailureKey(failure)
    const expanded = expandedFailures.has(failureKey)
    const retryLabel = failure.retry > 0 ? ` (retry x${failure.retry})` : ''
    const title = truncate(`${failure.title}${retryLabel}`, Math.max(8, width - 14))

    const duration = formatCompactDuration(failure.durationMs)
    rows.push(
      <Text
        key={`${failureKey}-header`}
        inverse={selected && focusPanel === 'failures'}
        color={selected && focusPanel === 'failures' ? 'black' : 'redBright'}
      >
        {`${absoluteIndex + 1}.`} {title} <Text color={selected && focusPanel === 'failures' ? 'black' : 'gray'}>{duration}</Text>
      </Text>,
    )
    remainingRows -= 1

    if (!expanded || remainingRows <= 0) {
      continue
    }

    if (remainingRows > 0) {
      rows.push(
        <Text key={`${failureKey}-file`} color="gray">
          {truncate(`  ${failure.file}`, Math.max(8, width - 1))}
        </Text>,
      )
      remainingRows -= 1
    }

    const details = buildFailureDetailRows(failure)
    for (let detailIndex = 0; detailIndex < details.length && remainingRows > 0; detailIndex += 1) {
      const detail = details[detailIndex]
      if (!detail) continue
      rows.push(
        <Text key={`${failureKey}-detail-${detailIndex}`} color={detail.color}>
          {truncate(detail.text, Math.max(8, width - 1))}
        </Text>,
      )
      remainingRows -= 1
    }
  }

  if (remainingRows > 0) {
    for (let index = 0; index < remainingRows; index += 1) {
      rows.push(<Text key={`failure-pad-${index}`}> </Text>)
    }
  }

  return <>{rows}</>
}

function SummaryPanel({
  state,
  width,
  maxRows,
}: {
  state: RunState
  width: number
  maxRows: number
}) {
  const indent = 0
  const lines: Array<{ color: string; text: string }> = [
    { color: 'magentaBright', text: 'SUMMARY' },
    {
      color: 'white',
      text: `total ${state.totalTests} │ pass ${state.passed} │ fail ${state.failed} │ skip ${state.skipped} │ retry ${state.retryCount}`,
    },
    { color: 'redBright', text: 'failed tests:' },
  ]

  for (const failure of state.failedTests.slice(0, 3)) {
    lines.push({ color: 'red', text: `- ${failure.title} (${failure.file})` })
  }

  lines.push({ color: 'yellowBright', text: 'slowest tests:' })
  for (const test of state.slowestTests.slice(0, 3)) {
    lines.push({ color: 'yellow', text: `- ${test.title} ${formatCompactDuration(test.durationMs)}` })
  }

  return (
    <Box flexDirection="column">
      {lines.slice(0, Math.max(1, maxRows)).map((lineEntry, index) => (
        <Text key={index} color={lineEntry.color}>
          {`${' '.repeat(indent)}${truncate(lineEntry.text, Math.max(8, width - indent - 1))}`}
        </Text>
      ))}
    </Box>
  )
}

function buildFailureDetailRows(failure: FailureViewState): Array<{ text: string; color: string }> {
  const rows: Array<{ text: string; color: string }> = [
    { text: `  ${failure.message}`, color: 'redBright' },
  ]

  if (failure.expected && failure.actual) {
    rows.push({ text: `  Expected: ${failure.expected}    Received: ${failure.actual}`, color: 'red' })
  }

  if (failure.stack) {
    for (const stackLine of failure.stack.split(/\r?\n/u).slice(0, 6)) {
      rows.push({
        text: `  ${stackLine}`,
        color: stackLine.includes('.spec.') || stackLine.includes('.ts:') ? 'cyan' : 'gray',
      })
    }
  }
  return rows
}

function miniBar(entry: FileProgressViewState, width: number): {
  passed: string
  failed: string
  skipped: string
  pending: string
} {
  const total = Math.max(1, entry.total)
  const passed = Math.floor((entry.passed / total) * width)
  const failed = Math.floor((entry.failed / total) * width)
  const skipped = Math.floor((entry.skipped / total) * width)
  const used = Math.min(width, passed + failed + skipped)
  const pending = Math.max(0, width - used)
  return {
    passed: '█'.repeat(passed),
    failed: '█'.repeat(Math.max(0, Math.min(width - passed, failed))),
    skipped: '█'.repeat(Math.max(0, Math.min(width - passed - failed, skipped))),
    pending: '░'.repeat(pending),
  }
}

function fileStatus(entry: FileProgressViewState): 'failed' | 'running' | 'passed' | 'partial' {
  if (entry.failed > 0) return 'failed'
  if (entry.running > 0) return 'running'
  if (entry.total > 0 && entry.completed >= entry.total) return 'passed'
  return 'partial'
}

function activitySymbol(status: RunState['recentActivity'][number]['status']): string {
  switch (status) {
    case 'failed':
      return '✗'
    case 'skipped':
      return '⊘'
    case 'flaky':
      return '↻'
    case 'timedOut':
      return '⧖'
    case 'interrupted':
      return '!'
    case 'passed':
    default:
      return '✓'
  }
}

function activityColor(status: RunState['recentActivity'][number]['status']): string {
  switch (status) {
    case 'failed':
    case 'timedOut':
      return 'redBright'
    case 'skipped':
      return 'yellowBright'
    case 'flaky':
      return 'magentaBright'
    case 'interrupted':
      return 'yellow'
    case 'passed':
    default:
      return 'greenBright'
  }
}

function formatCompactDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

function line(width: number): string {
  return '─'.repeat(Math.max(1, width - 1))
}

function BlankLines({ count }: { count: number }) {
  if (count <= 0) {
    return null
  }
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Text key={`blank-${index}`}> </Text>
      ))}
    </>
  )
}

function padLeft(value: string, width: number): string {
  if (value.length >= width) return value
  return `${' '.repeat(width - value.length)}${value}`
}

function setFlashState(
  setFlash: React.Dispatch<React.SetStateAction<FlashState | null>>,
  message: string,
  color: FlashState['color'],
): void {
  setFlash({
    message,
    color,
    expiresAt: Date.now() + 1500,
  })
}

function toFailureKey(failure: FailureViewState): string {
  return `${failure.at}|${failure.project}|${failure.file}|${failure.title}`
}

function windowStart(total: number, selected: number, visible: number): number {
  if (total <= visible) return 0
  const half = Math.floor(visible / 2)
  const maxStart = total - visible
  return clamp(selected - half, 0, maxStart)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
