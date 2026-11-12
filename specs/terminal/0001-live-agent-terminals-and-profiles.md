# 0001 — Live agent terminals and terminal profiles

| Field | Value |
| --- | --- |
| Status | approved |
| Area | terminal (terminal-controller, terminal, terminal-bash, subprocess-local, tool-bash, job-controller, client ui-sidebar-terminal, ui-tool) |
| Owner | henriqqw |
| Created | 2026-11-12 |
| Related | [spec session/0001](../session/0001-conversation-actions.md), research report "Agent harness features research" (local) |

## Problem

Users cannot watch what agents do in a shell while it happens. A foreground `bash`/`pwsh` tool card shows output only after the command settles, and the persistent agent shells (`ctx.terminals`: persistent bash, the experimental terminal tools) have no view at all. Only background jobs stream to the job roster. When a command hangs, prompts for input, or runs for minutes, the user sees a spinner.

The user terminal panel launches one shell chosen from executable names (`zsh, bash, fish, pwsh, powershell, cmd`). There is no profile list: no WSL distributions (Ubuntu, Debian), no Git Bash, no display names, arguments, or environment per entry, and no default choice stored on the Host. A Host running inside WSL cannot offer the Windows shells, and a Host on Windows cannot offer WSL distributions.

## Goals

- Stream a foreground agent command's output into its tool card while it runs.
- Show every agent PTY session of the open conversation as a live, read-only tab in the Terminal sidebar, with an explicit take-over and give-back.
- Replace the executable-name list with terminal profiles, modeled on VS Code: auto-detected per OS plus user-defined entries, a Host-stored default, and a profile menu when opening a terminal.
- Detect WSL distributions on Windows Hosts, and Windows shells (PowerShell, Command Prompt) on WSL Hosts through WSL interop.

## Non-goals

- Changing which shell dialect the agent's tools use (`bash` or `pwsh` stay the agent dialects; their configuration is unchanged).
- Running agent commands in a PTY by default; one-shot `bash`/`pwsh` keep pipes.
- Shell integration for cmd (it has no OSC 133 support).
- Remote or multi-user terminal sharing; the single operator Peer and the existing connection admission stay as they are.
- Sandboxing user terminals; they keep full system-user permissions, as today.

## User-visible behavior

- **Live tool cards** — while an agent's `bash` or `pwsh` command runs, its card shows the output as it arrives (the last lines, with a scroll area), and a stop button. When the command settles the card shows the same final result as today.
- **Agent tabs** — when an agent opens a persistent shell, the Terminal sidebar gains a tab named after it with an "Agent" badge. The tab streams the agent's screen live and is read-only. **Take over** gives the user the keyboard; while the user holds control the agent's writes to that shell are refused with a message telling it the user is in control. **Give back** returns control. Closing the conversation or the agent closing the shell removes the tab.
- **Profiles** — the new-terminal button opens a menu of profiles, for example "Ubuntu (WSL)", "Debian (WSL)", "PowerShell", "Command Prompt", "Git Bash", "bash", "zsh", each with an icon. The default profile is marked and is used by the plain new-terminal action. The menu offers **Make <profile> the default**, which stores the Host default through the Settings service. The last profile used in a browser is still remembered locally for that browser.

## Acceptance criteria

- **AC-1** — Given an agent runs a foreground command that prints a line per second for five seconds, when the user watches its tool card, then lines appear while the command runs, before the tool call settles.
- **AC-2** — Given an agent opens a persistent shell, when the user opens the Terminal sidebar, then an Agent tab shows that shell's screen and updates as the agent sends commands; typing in it has no effect.
- **AC-3** — Given an Agent tab, when the user takes over and types, then the input reaches the shell, and an agent write during that time fails with `TERMINAL_USER_CONTROL`; after give-back the agent's writes succeed again.
- **AC-4** — Given a Windows Host with WSL distributions Ubuntu and Debian, when the profile list is requested, then it contains one WSL profile per distribution, launched as `wsl.exe -d <name>`.
- **AC-5** — Given a Host running inside WSL with interop enabled, when the profile list is requested, then it contains "PowerShell" and "Command Prompt" profiles that start in the terminal's working directory translated to a Windows path.
- **AC-6** — Given a configured profile with `args` and `env`, when the user opens it, then the shell starts with those arguments and environment variables.
- **AC-7** — Given a default profile set from the profile menu, when the user uses the plain new-terminal action in any browser, then that profile opens.
- **AC-8** — Given a detected profile whose executable no longer exists, when the user opens it, then creation fails with an actionable error and no terminal is left behind.
- **AC-9** — Given the existing `shell` and `shellCandidates` configuration, when the Host starts, then they keep working: `shell` becomes a user-defined profile and candidates are still probed.

## Contracts

- **terminal-controller Config**
  - `profiles` (array, default `[]`): `{ id: string (^[\w-]{1,64}$), name: string, path: string, args?: string[], env?: Record<string,string>, icon?: 'bash' | 'zsh' | 'fish' | 'pwsh' | 'cmd' | 'wsl' | 'git' | 'terminal' }`. User entries override a detected entry with the same `id`.
  - `detectProfiles` (boolean, default `true`): run OS detection.
  - `defaultProfile` (string, optional, volatile so the Settings service can edit it): profile id; validated against the resolved list at request time.
  - `shell` and `shellCandidates` stay, deprecated in docs; `shell` maps to a profile with id `configured`.
- **terminal-controller Remote**
  - `terminal.profiles()` → `{ profiles: TerminalProfileView[], defaultProfileId?: string }`; replaces the role of `terminal.shells`, which stays as a compatibility alias returning the same entries.
  - `terminal.create` gains `profileId?: string` (preferred over `shellPath`).
  - `terminal.agentList({ sessionId })` → agent PTY sessions of that conversation (`{ id, title, ownerAgentId, controlledBy: 'agent' | 'user' }`).
  - `terminal.followAgent({ sessionId, terminalId })` (stream): the same `snapshot | output | state` frames as `follow`.
  - `terminal.takeOver({ sessionId, terminalId })`, `terminal.giveBack(...)`, and `terminal.writeAgent(...)` (accepted only while the user holds control).
- **ctx.terminals (terminal package)** — sessions gain an observable screen (`subscribe(listener)` over the existing headless xterm state) and a `control: 'agent' | 'user'` field; `send` from the owning agent while `control === 'user'` rejects with `TERMINAL_USER_CONTROL`.
- **Jobs** — `JobSpec` and `JobView` gain an optional `callId`; `bash`/`pwsh` set it to the tool call id when a foreground command becomes a job, so the client finds the running job of a tool call and follows it through `job.follow`. No new session-log event.
- **Session log** — unchanged; no new events, no format change.

## Design

- **Profiles** (`api/terminal-controller`, new module `profiles.ts`):
  - Detection runs per Host OS and caches for the process lifetime, with a refresh on `terminal.profiles({ refresh: true })`.
  - **Windows:** `%ComSpec%` (Command Prompt), `pwsh.exe` and `powershell.exe` on PATH, Git Bash from `%ProgramFiles%\Git\bin\bash.exe` (and `%LocalAppData%\Programs\Git`), launched with `--login -i`; WSL distributions from `wsl.exe -l -q` (UTF-16LE output, decoded and trimmed, Docker utility distributions skipped).
  - **Linux/macOS:** shells listed in `/etc/shells` that match the known names, plus the user's `$SHELL`.
  - **WSL Host** (detected through `WSL_DISTRO_NAME` or `/proc/sys/fs/binfmt_misc/WSLInterop`): adds `powershell.exe` and `cmd.exe` through interop when they resolve; the working directory is translated with `wslpath -w` and passed through `args`/`cwd` handling for Windows executables.
  - Each profile is re-verified with `resolveExecutable` at `create`; failures map to `terminal/profile-unavailable`.
- **Default profile** — a volatile `defaultProfile` field of the `terminal-controller` entry, written through `ctx.configForms` from the profile menu and persisted in the active profile's Cordis patch.
- **Live tool cards** — `tool-bash`/`tool-pwsh` already hand non-consuming readers to the job registry, which feeds an output ring. The job carries the tool call id; `ui-tool`'s bash card finds that job in the Session's job rows while the call is open, follows its output through the client jobs service, and switches to the durable result on settle.
- **Agent tabs and take-over** — `terminal` sessions expose their headless screen through a subscription; `terminal-controller` bridges the conversation's agent sessions as read-only streams; `ui-sidebar-terminal` renders them as a second tab group. Take-over flips `control`; the owning agent's `send` then rejects, and user input goes through `writeAgent`. Control returns to the agent on give-back, when the user's attachment detaches, or when the conversation's turn ends with the user still holding control (with a notice).
- **Security** — all new methods go through the existing connection admission (trusted host, Origin check, per-launch cookie). `writeAgent` keeps the `maxInputBytes` cap and the latest-attachment rule.
- **Alternatives considered** — running every agent command in a PTY (rejected: breaks the one-shot contract and costs tokens); a separate terminal page (rejected: the sidebar already hosts terminals); a client-only profile list (rejected: detection needs the Host).

## Risks and mitigations

- `wsl.exe` hangs when WSL is broken → detection runs with a 3-second timeout and degrades to no WSL profiles.
- Agent output floods the card → the card renders the bounded job ring; the model's tool result is unchanged.
- The user forgets to give back → automatic return on detach or turn end, with a notice in the tab.
- Windows paths for interop shells → only directories under `/mnt/<drive>` or translatable by `wslpath` are passed; otherwise the shell starts in the Windows user's home and the tab says so.

## Rollout

Ships in the `web-app` composition with no flag. Existing `shell`/`shellCandidates` configuration keeps working (AC-9). The terminal-controller README and the user guide get a "Terminal profiles" section (EN/ZH). No upgrade-guide entry: nothing breaks.

## Implementation plan

1. Profiles: detection module, Config, `terminal.profiles`/`setDefaultProfile`/`create(profileId)`, tests (AC-4–AC-9).
2. Profile menu with the default action in `ui-sidebar-terminal` (AC-7).
3. Live tool cards: `callId` on jobs, `ui-tool` bash card following the job (AC-1).
4. Agent tabs: observable `ctx.terminals` screens, `agentList`/`followAgent`, sidebar tab group (AC-2).
5. Take-over and give-back with `TERMINAL_USER_CONTROL` (AC-3).
6. Docs, catalogs, gates.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | `packages/client/ui-tool/tests/terminal-card.client.spec.tsx` (live output), `packages/shell/tool-bash/tests/background.spec.ts`, `packages/shell/tool-pwsh/tests/background.spec.ts` (call id on the job) | ☑ |
| AC-2 | — | ☐ |
| AC-3 | — | ☐ |
| AC-4 | `packages/api/terminal-controller/tests/profiles.spec.ts` (Windows detection) | ☑ |
| AC-5 | `packages/api/terminal-controller/tests/profiles.spec.ts` (WSL interop detection) | ☑ |
| AC-6 | `packages/api/terminal-controller/tests/profiles.spec.ts` (arguments and environment) | ☑ |
| AC-7 | `packages/api/terminal-controller/tests/profiles.spec.ts`, `packages/client/ui-sidebar-terminal/tests/terminal-guide.client.spec.tsx`, `packages/client/ui-sidebar-terminal/tests/apply.client.spec.ts` | ☑ |
| AC-8 | `packages/api/terminal-controller/tests/profiles.spec.ts` (unavailable profile) | ☑ |
| AC-9 | `packages/api/terminal-controller/tests/profiles.spec.ts`, `packages/api/terminal-controller/tests/controller.spec.ts` | ☑ |
