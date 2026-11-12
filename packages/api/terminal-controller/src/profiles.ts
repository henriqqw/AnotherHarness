/** Terminal profiles: detected shells of the execution environment plus configured entries, modeled on VS Code terminal profiles. */
import type { SubprocessRuntime } from '@anotherharness/ah-subprocess'
import type { TerminalProfile, TerminalProfileIcon, TerminalShell } from './types.ts'

/** A user-defined profile from the controller configuration. */
export interface TerminalProfileConfig {
  /** Stable identity; a configured entry replaces a detected entry with the same id. */
  id: string
  /** User-visible name. */
  name: string
  /** Executable path or PATH name, verified by the subprocess provider. */
  path: string
  /** Arguments passed to the shell. */
  args?: string[] | undefined
  /** Environment variables layered onto the terminal's environment. */
  env?: Record<string, string> | undefined
  /** Menu icon. */
  icon?: TerminalProfileIcon | undefined
}

/** Bound on each detection command, so a broken WSL install cannot stall the profile list. */
export const DETECTION_TIMEOUT_MS = 3000

/** Git for Windows install locations probed for Git Bash. */
export const GIT_BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
] as const

const POSIX_SHELL_KINDS = ['bash', 'zsh', 'fish', 'pwsh'] as const
const PROBE_MARKER = '@@ah-terminal-probe@@'

function executableName(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
}

/**
 * The shell kind an executable path names: its file name, lowercased, without `.exe`.
 * @param path - executable path or PATH name.
 * @returns the kind, for example `bash`, `pwsh`, or `cmd`.
 */
export function shellKind(path: string): string {
  return executableName(path).toLowerCase().replace(/\.exe$/u, '')
}

/**
 * The default interactive arguments for a shell kind.
 * @param kind - shell kind from {@link shellKind}.
 * @returns no arguments for cmd, `-NoLogo` for PowerShell, and `-i` otherwise.
 */
export function interactiveArgs(kind: string): string[] {
  if (kind === 'cmd') return []
  if (kind === 'pwsh' || kind === 'powershell') return ['-NoLogo']
  return ['-i']
}

/**
 * The menu icon for a shell kind.
 * @param kind - shell kind from {@link shellKind}.
 * @returns the matching icon, or the generic terminal icon.
 */
export function iconFor(kind: string): TerminalProfileIcon {
  if (kind === 'bash' || kind === 'zsh' || kind === 'fish' || kind === 'cmd' || kind === 'wsl') return kind
  if (kind === 'pwsh' || kind === 'powershell') return 'pwsh'
  return 'terminal'
}

/**
 * A stable profile identity derived from a display name.
 * @param prefix - identity namespace, for example `wsl`.
 * @param name - display name.
 * @returns a lowercase identity matching `^[\w-]{1,64}$`.
 */
export function profileId(prefix: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
  return `${prefix}-${slug === '' ? 'shell' : slug}`.slice(0, 64)
}

/**
 * Parse `wsl.exe -l -q` output into distribution names. The command prints
 * UTF-16LE unless `WSL_UTF8=1` is honored, so NUL bytes are stripped; Docker
 * Desktop's utility distributions are not user shells.
 * @param output - raw command output.
 * @returns distribution names in listed order.
 */
export function parseWslDistributions(output: string): string[] {
  return output.replaceAll('\u0000', '').replace(/^\uFEFF/u, '').split(/\r?\n/u)
    .map(line => line.trim())
    .filter(name => name !== '' && !name.toLowerCase().startsWith('docker-desktop'))
}

/** Facts a POSIX execution environment reports in one probe. */
export interface PosixProbe {
  /** Shell paths listed in `/etc/shells`. */
  readonly shells: string[]
  /** Whether the environment runs inside WSL with Windows interop enabled. */
  readonly wslInterop: boolean
}

/**
 * Parse the POSIX probe script's output.
 * @param output - stdout of {@link POSIX_PROBE_SCRIPT}.
 * @returns the listed shells and the WSL interop flag.
 */
export function parsePosixProbe(output: string): PosixProbe {
  const [shellPart = '', facts = ''] = output.split(PROBE_MARKER)
  const shells = shellPart.split(/\r?\n/u).map(line => line.trim()).filter(line => line.startsWith('/'))
  return { shells, wslInterop: /\binterop=1\b/u.test(facts) }
}

/** Lists `/etc/shells` and reports whether WSL interop is available. */
export const POSIX_PROBE_SCRIPT = `cat /etc/shells 2>/dev/null; echo '${PROBE_MARKER}'; `
  + 'if [ -e /proc/sys/fs/binfmt_misc/WSLInterop ] || [ -e /proc/sys/fs/binfmt_misc/WSLInterop-late ]; then echo interop=1; fi'

async function capture(
  subprocess: SubprocessRuntime, argv: readonly string[], cwd: string, signal: AbortSignal,
  env?: Record<string, string>,
): Promise<string | undefined> {
  try {
    const handle = subprocess.spawn({
      argv, cwd, graceMs: 200,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 64 * 1024 }, stderr: { maxBytes: 4 * 1024 } },
      signal: AbortSignal.any([signal, AbortSignal.timeout(DETECTION_TIMEOUT_MS)]),
      ...env === undefined ? {} : { env },
    })
    const outcome = await handle.done
    if (outcome.exitCode !== 0) return undefined
    return handle.collected.stdout?.readFrom(0).text
  } catch {
    // A missing, failing, or timed-out probe only means fewer detected profiles.
    signal.throwIfAborted()
    return undefined
  }
}

async function resolved(subprocess: SubprocessRuntime, path: string, signal: AbortSignal): Promise<string | undefined> {
  try {
    return await subprocess.resolveExecutable(path, undefined, signal)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'SubprocessExecutableNotFoundError') return undefined
    throw error
  }
}

async function windowsProfiles(
  subprocess: SubprocessRuntime, defaultShell: string | undefined, cwd: string, signal: AbortSignal,
): Promise<TerminalProfile[]> {
  const found: TerminalProfile[] = []
  const add = async (id: string, name: string, path: string, args: string[], icon: TerminalProfileIcon): Promise<void> => {
    const executable = await resolved(subprocess, path, signal)
    if (executable !== undefined) found.push({ id, name, path: executable, args, icon, source: 'detected' })
  }
  await add('cmd', 'Command Prompt', defaultShell ?? 'cmd.exe', [], 'cmd')
  await add('pwsh', 'PowerShell', 'pwsh.exe', ['-NoLogo'], 'pwsh')
  await add('windows-powershell', 'Windows PowerShell', 'powershell.exe', ['-NoLogo'], 'pwsh')
  for (const path of GIT_BASH_PATHS) {
    if (found.some(profile => profile.id === 'git-bash')) break
    await add('git-bash', 'Git Bash', path, ['--login', '-i'], 'git')
  }
  const wsl = await resolved(subprocess, 'wsl.exe', signal)
  if (wsl !== undefined) {
    const listing = await capture(subprocess, [wsl, '-l', '-q'], cwd, signal, { WSL_UTF8: '1' })
    for (const distribution of parseWslDistributions(listing ?? '')) {
      found.push({ id: profileId('wsl', distribution), name: `${distribution} (WSL)`, path: wsl, args: ['-d', distribution], icon: 'wsl', source: 'detected' })
    }
  }
  return found
}

async function posixProfiles(
  subprocess: SubprocessRuntime, defaultShell: string | undefined, cwd: string, signal: AbortSignal,
): Promise<TerminalProfile[]> {
  const probe = parsePosixProbe(await capture(subprocess, ['/bin/sh', '-c', POSIX_PROBE_SCRIPT], cwd, signal) ?? '')
  const byKind = new Map<string, string>()
  for (const path of [...defaultShell === undefined ? [] : [defaultShell], ...probe.shells]) {
    const kind = shellKind(path)
    if ((POSIX_SHELL_KINDS as readonly string[]).includes(kind) && !byKind.has(kind)) byKind.set(kind, path)
  }
  const found: TerminalProfile[] = []
  for (const [kind, path] of byKind) {
    const executable = await resolved(subprocess, path, signal)
    if (executable !== undefined) found.push({ id: kind, name: kind === 'pwsh' ? 'PowerShell' : kind, path: executable, args: interactiveArgs(kind), icon: iconFor(kind), source: 'detected' })
  }
  if (probe.wslInterop) {
    // WSL interop starts Windows executables in the Linux working directory translated to a Windows path.
    for (const [id, name, path] of [['windows-powershell', 'Windows PowerShell', 'powershell.exe'], ['cmd', 'Command Prompt', 'cmd.exe']] as const) {
      const executable = await resolved(subprocess, path, signal)
      if (executable !== undefined) found.push({ id, name, path: executable, args: interactiveArgs(shellKind(path)), icon: iconFor(shellKind(path)), source: 'detected' })
    }
  }
  return found
}

/**
 * Detect the execution environment's shells: Command Prompt, PowerShell, Git Bash, and
 * WSL distributions on Windows; `/etc/shells` entries and, inside WSL, the interop Windows
 * shells on POSIX. Every entry is verified through the provider; probe failures degrade
 * to fewer profiles.
 * @param subprocess - target execution provider.
 * @param cwd - directory the probe commands run in.
 * @param signal - detection cancellation.
 * @returns detected profiles in menu order.
 */
export async function detectProfiles(subprocess: SubprocessRuntime, cwd: string, signal: AbortSignal): Promise<TerminalProfile[]> {
  const environment = await subprocess.terminalEnvironment(signal)
  return environment.platform === 'windows'
    ? windowsProfiles(subprocess, environment.defaultShell, cwd, signal)
    : posixProfiles(subprocess, environment.defaultShell, cwd, signal)
}

/**
 * Merge profile sources into one list: the legacy configured shell first, then detected
 * profiles, then legacy candidates of a kind not yet listed, then configured profiles,
 * which replace an entry with the same id.
 * @param sources - each source's entries.
 * @param sources.configuredShell - the legacy `shell` profile, if any.
 * @param sources.detected - detected profiles.
 * @param sources.candidates - verified legacy `shellCandidates` shells.
 * @param sources.configured - user-defined profiles, already verified.
 * @returns the merged list, one entry per id.
 */
export function mergeProfiles(sources: {
  configuredShell?: TerminalShell | undefined
  detected: readonly TerminalProfile[]
  candidates: readonly TerminalShell[]
  configured: readonly TerminalProfile[]
}): TerminalProfile[] {
  const merged = new Map<string, TerminalProfile>()
  const kinds = new Set<string>()
  const put = (profile: TerminalProfile): void => {
    if (!merged.has(profile.id)) merged.set(profile.id, profile)
    if (profile.icon !== 'wsl') kinds.add(shellKind(profile.path))
  }
  if (sources.configuredShell !== undefined) {
    const shell = sources.configuredShell
    put({ ...shell, id: 'configured', icon: iconFor(shellKind(shell.path)), source: 'configured' })
  }
  for (const profile of sources.detected) put(profile)
  for (const shell of sources.candidates) {
    const kind = shellKind(shell.path)
    if (kinds.has(kind)) continue
    put({ ...shell, id: profileId('shell', kind), icon: iconFor(kind), source: 'detected' })
  }
  for (const profile of sources.configured) merged.set(profile.id, profile)
  return [...merged.values()]
}

/**
 * Verify one configured profile in the execution environment.
 * @param subprocess - target execution provider.
 * @param profile - configured entry.
 * @param signal - verification cancellation.
 * @returns the profile with its resolved path, or undefined when the executable is missing.
 */
export async function verifyConfiguredProfile(
  subprocess: SubprocessRuntime, profile: TerminalProfileConfig, signal: AbortSignal,
): Promise<TerminalProfile | undefined> {
  const path = await resolved(subprocess, profile.path, signal)
  if (path === undefined) return undefined
  const kind = shellKind(profile.path)
  return {
    id: profile.id, name: profile.name, path, args: profile.args ?? interactiveArgs(kind),
    icon: profile.icon ?? iconFor(kind), source: 'configured',
    ...profile.env === undefined ? {} : { env: profile.env },
  }
}
