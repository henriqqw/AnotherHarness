/** Live output of a running foreground shell command, followed through the client jobs service. */
import { useEffect, type ReactNode } from 'react'
import type { IJobs } from '@anotherharness/ah-api-job-controller/client'
import type { SessionId } from '@anotherharness/ah-session/types'
import type { InjectFace } from '@anotherharness/ah-client-ui-slots'
import css from './bash-sample.module.css'

/** Lines of the running output shown in the card. */
export const LIVE_OUTPUT_LINES = 12

/** The jobs service face the Bash card receives when the jobs service is mounted. */
export interface LiveJobsInjected {
  readonly hooks: { readonly jobs: IJobs['state'] }
  readonly watchRows: IJobs['watchRows']
  readonly observe: IJobs['observe']
}

/** Bound jobs hooks and actions, or none when no jobs service is mounted. */
export type LiveJobsProps = Partial<InjectFace<LiveJobsInjected>>

/**
 * The last lines of an output tail.
 * @param text - accumulated output.
 * @param lines - lines to keep.
 * @returns the trailing lines without a final empty line.
 */
export function outputTail(text: string, lines: number): string {
  return text.replace(/\n$/u, '').split('\n').slice(-lines).join('\n')
}

/**
 * Follow the running job a tool call registered and show its latest output.
 * @param props - the Session, the tool call, bound jobs hooks, and the accessible label.
 * @returns the live output, or nothing before the first output arrives.
 */
export function LiveShellOutput({ sessionId, callId, useJobs, watchRows, observe, label }: {
  sessionId: SessionId
  callId: string
  useJobs: NonNullable<LiveJobsProps['useJobs']>
  watchRows: IJobs['watchRows']
  observe: IJobs['observe']
  label: string
}): ReactNode {
  useEffect(() => watchRows(sessionId), [sessionId, watchRows])
  const jobId = useJobs(state => state.rows[sessionId]?.find(job => job.callId === callId && job.status === 'running')?.id)
  useEffect(() => jobId === undefined ? undefined : observe(sessionId, jobId), [sessionId, jobId, observe])
  const text = useJobs(state => jobId === undefined ? '' : state.observed[jobId]?.text ?? '')
  if (text === '') return null
  return (
    <pre className={css.liveOutput} aria-label={label} aria-live="polite" data-live-output>
      {outputTail(text, LIVE_OUTPUT_LINES)}
    </pre>
  )
}
