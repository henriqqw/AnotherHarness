# Loadable Harness plugin packages

This file is GENERATED from workspace manifests (`scripts/gen-plugin-packages.ts`) and verified fresh by `pnpm run verify-plugin-packages` (part of `doc-sync`); do not edit it by hand.

Every package below exports a Cordis plugin that a bundle patch can name in a Loader row. `Config` marks packages whose row accepts a `config` mapping; query `Config.listConfigs` through `cordis_inspect_query` (filter by `name`, then query the `entry` id) for the mounted schema. Packages under `experimental` are pre-stable.

## acp

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-acp` | yes | Automation-only Agent Client Protocol server for driving AnotherHarness agents over JSON-RPC stdio |

## api

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-api-account-controller` | no | Expose safe account operations over authenticated Remote |
| `@anotherharness/ah-api-gateway` | yes | Typert Remote Host dispatcher and Client API endpoint |
| `@anotherharness/ah-api-job-controller` | yes | Job Remote observation stream and the reference-counted client job-output service |
| `@anotherharness/ah-api-remotes` | no | Remote BFF assembly for application-selected Host capabilities |
| `@anotherharness/ah-api-session-controller` | yes | Session Remote commands, cold reads, and live control transport |
| `@anotherharness/ah-api-settings-controller` | yes | Remote owner for the configuration surfaces over the settings-domain seams |
| `@anotherharness/ah-api-terminal-controller` | yes | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control |
| `@anotherharness/ah-api-workspace-controller` | yes | Workspace Remote commands and reconnect-safe state transport |
| `@anotherharness/ah-api-workspace-files` | yes | Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace |

## attachment

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-attachment-local` | yes | Private content-addressed AH_HOME attachment storage |

## boot

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-config-editor` | no | Persist plugin configuration through profile patches and Loader reconciliation |
| `@anotherharness/ah-hmr` | yes | Coordinated module and profile configuration hot reload |
| `@anotherharness/ah-plugin-manager` | yes | Current-profile plugin and bundle management shared by ah CLI, Web and agent tools |

## browser-use

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-browser-use` | no | Exclusive named browser-use provider registration |

## bundle

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-acp-app` | no | The ah ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over ah-base |
| `@anotherharness/ah-headless` | yes | The ah one-shot bundle: a direct core Agent/Session runner over ah-base with no Host, HTTP, or browser layer |
| `@anotherharness/ah-sdk-app` | yes | The ah SDK profile bundle: stdio JSON-RPC serving and process lifecycle over ah-base |
| `@anotherharness/ah-web-app` | yes | The ah browser-surface bundle: the web patch layer over ah-base plus the runtime glue plugin (frontend dist serving, web-surface prompt, bash runtime variables, URL line) |

## client

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-client-connection` | yes | Authenticated RPC transport and generation lifecycle |
| `@anotherharness/ah-client-file-upload` | no | Agent-scoped browser file upload, streaming intake, and staged receipt service |
| `@anotherharness/ah-client-hmr` | yes | Web client graph synchronization and rebuilt-bundle reload transport |
| `@anotherharness/ah-client-locale` | no | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| `@anotherharness/ah-client-modules` | no | Client module system, dual-face: node half composes the __AH_BOOT__ entry graph (incremental ah.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| `@anotherharness/ah-client-product-analytics` | yes | Desktop product event collection and authenticated Host reporting |
| `@anotherharness/ah-client-resources` | no | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| `@anotherharness/ah-client-shortcuts` | yes | Application keyboard command registry and physical-key routing |
| `@anotherharness/ah-client-ui-agent-preset` | no | Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor |
| `@anotherharness/ah-client-ui-approval` | no | Approval composer takeover over the scoped Remote Event waterfall |
| `@anotherharness/ah-client-ui-attachment` | no | Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots |
| `@anotherharness/ah-client-ui-brand-official` | no | Official AnotherHarness brand occupants for the Web client's sidebar slots |
| `@anotherharness/ah-client-ui-chat` | no | Chat Conversation target, node definitions, renderers, and details surface |
| `@anotherharness/ah-client-ui-code-editor` | no | CodeMirror 6 code editor for workspace files: edit and save from the file preview with VS Code keys, conflict handling, minimap, and autocomplete |
| `@anotherharness/ah-client-ui-commands` | no | Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry |
| `@anotherharness/ah-client-ui-conversation` | no | Target-neutral Conversation assembly, shell, composer, queue, and view navigation |
| `@anotherharness/ah-client-ui-deliverables` | no | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web |
| `@anotherharness/ah-client-ui-directory-picker-browse` | no | In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives |
| `@anotherharness/ah-client-ui-directory-picker-native` | no | Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser |
| `@anotherharness/ah-client-ui-goal` | no | Session goal surface: GoalBar docked above the composer, read from the goal session projection |
| `@anotherharness/ah-client-ui-input-trigger` | no | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources |
| `@anotherharness/ah-client-ui-jobs` | no | Session-header background-job list with on-demand streaming record panels |
| `@anotherharness/ah-client-ui-layout` | no | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| `@anotherharness/ah-client-ui-message-feedback` | no | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes |
| `@anotherharness/ah-client-ui-model-selection` | no | Model selection over the shared model catalog, Session projection, and session.selectModel |
| `@anotherharness/ah-client-ui-open-in-app` | no | Web "Open In..." controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file |
| `@anotherharness/ah-client-ui-permission-presets` | no | Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection |
| `@anotherharness/ah-client-ui-plan` | no | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews |
| `@anotherharness/ah-client-ui-plugin-manager` | yes | Plugin management for the ah web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages |
| `@anotherharness/ah-client-ui-reference` | no | Unified Web @file and @session reference source |
| `@anotherharness/ah-client-ui-renderer` | no | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| `@anotherharness/ah-client-ui-schedule` | no | Host task management page and Session reminder catalog |
| `@anotherharness/ah-client-ui-session` | no | Session Controller adapter for React and session-scoped slots |
| `@anotherharness/ah-client-ui-settings` | no | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| `@anotherharness/ah-client-ui-settings-account` | yes | Manage DeepSeek login and open Platform billing pages |
| `@anotherharness/ah-client-ui-settings-agent-loop` | no | Settings page of the agent loop on the ah web client's Plugins page: the parallel tool-call cap of the agent-loop namespace |
| `@anotherharness/ah-client-ui-settings-general` | no | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice |
| `@anotherharness/ah-client-ui-settings-models` | yes | Models settings and shared product-onboarding dialogs over existing settings and credential joins |
| `@anotherharness/ah-client-ui-settings-plugin-inventory` | no | Read-only Cordis Loader inventory tab in Web Plugins settings |
| `@anotherharness/ah-client-ui-settings-plugins` | no | Built-in plugins settings section for the ah web client: the Settings navigation entry and the tab chrome feature-owned tabs register into |
| `@anotherharness/ah-client-ui-settings-session-log` | no | General settings control for Session-log upload with DeepSeek API requests |
| `@anotherharness/ah-client-ui-settings-shell` | no | Settings page of the shell executor on the ah web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace |
| `@anotherharness/ah-client-ui-settings-subagent` | no | Settings page of Subagent delegation on the ah web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents |
| `@anotherharness/ah-client-ui-settings-web-search` | no | Settings page of the DeepSeek web-search provider on the ah web client's Plugins page: its API key, endpoint, and per-request search budget |
| `@anotherharness/ah-client-ui-shortcuts` | no | Keyboard shortcut reference, recording, and local preference editing |
| `@anotherharness/ah-client-ui-sidebar` | no | Sidebar plugin: session multi-level tree, search, grouping, state dots |
| `@anotherharness/ah-client-ui-sidebar-browser` | no | Sandboxed Web browser tabs for the right Sidebar |
| `@anotherharness/ah-client-ui-sidebar-documentpreview` | yes | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text |
| `@anotherharness/ah-client-ui-sidebar-files` | no | Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar |
| `@anotherharness/ah-client-ui-sidebar-right` | no | Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it |
| `@anotherharness/ah-client-ui-sidebar-terminal` | no | Interactive shell tabs for the right Sidebar |
| `@anotherharness/ah-client-ui-skill` | no | Web skill references and the dedicated skill tool row |
| `@anotherharness/ah-client-ui-subagent` | no | Subagent conversation catalog, continuation routing UI, and '@' reference source |
| `@anotherharness/ah-client-ui-theme` | yes | Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row |
| `@anotherharness/ah-client-ui-tool` | no | Client Tool call-tree renderer and keyed per-tool presentation slot |
| `@anotherharness/ah-client-ui-trajectory` | no | Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service) |
| `@anotherharness/ah-client-ui-user-questions` | no | Web ask_user_question composer takeover and plan-review presentation UI |
| `@anotherharness/ah-client-ui-workflow-run` | no | Durable workflow-run Conversation Node and nested member disclosure for ah web |
| `@anotherharness/ah-client-ui-workspace` | no | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots |

## compaction

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-command-compact` | no | Human-facing slash command for explicit session compaction |
| `@anotherharness/ah-compaction-basic` | yes | Token-meter-driven compaction policy and LLM summarization backend for the AnotherHarness |
| `@anotherharness/ah-compaction-image-offload` | no | Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry |
| `@anotherharness/ah-compaction-tool-result-pruner` | yes | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes |

## computer-use

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-computer-use` | no | Exclusive named computer-use provider registration |

## context

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-agent-instructions` | yes | Workspace context loader for AGENTS.md/CLAUDE.md instruction files |
| `@anotherharness/ah-file-reference-local` | yes | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes |
| `@anotherharness/ah-session-reference` | yes | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver) |
| `@anotherharness/ah-time-context` | yes | Durable per-step context with the current time and elapsed time |
| `@anotherharness/ah-tmux-context` | yes | Opt-in durable per-step context with this agent's tmux pane and window location |

## core

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-agent` | no | Agent interface, registry, initiator scope, and event vocabulary for the AnotherHarness |
| `@anotherharness/ah-agent-default-model` | yes | Default model selection shared by Agent entry points |
| `@anotherharness/ah-agent-loop` | yes | The concrete agent loop plugin for the AnotherHarness |
| `@anotherharness/ah-agent-tool-presentation` | yes | Agent-plane presentation selector: composes one agent's tools as PTC mode or native tool calls |
| `@anotherharness/ah-session` | no | Event-sourced session store for the AnotherHarness |
| `@anotherharness/ah-system-prompt` | yes | System prompt assembly registry for the AnotherHarness |
| `@anotherharness/ah-tools` | yes | Tool registry and execution pipeline for the AnotherHarness |

## credentials

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-authorization` | no | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human |
| `@anotherharness/ah-credentials-local` | yes | File-backed credentials provider ($AH_HOME/.env under the live process environment) for the AnotherHarness |
| `@anotherharness/ah-deepseek-account-platform` | yes | Authorize DeepSeek accounts through browser PKCE |

## deliverables

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-tool-present` | yes | Explicit workspace file delivery declarations for the AnotherHarness |
| `@anotherharness/ah-workspace-changes` | yes | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the AnotherHarness |

## document

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-office-to-pdf` | yes | Shared Office-to-PDF conversion with bounded queues and caching |

## experimental

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-experimental-agent-team` | yes | Implicit-root Agent Teams roster, direct peer messaging, and shared task DAG |
| `@anotherharness/ah-experimental-api-speech-to-text` | yes | Authenticated experimental speech transcription for browser clients |
| `@anotherharness/ah-experimental-auto-review` | no | Per-tool LLM authorization review for the AnotherHarness Auto permission preset |
| `@anotherharness/ah-experimental-browser-use-chrome-devtools-mcp` | yes | Experimental per-Session Chromium browser tools through chrome-devtools-mcp |
| `@anotherharness/ah-experimental-browser-use-playwright-mcp` | yes | Experimental per-Session Chromium browser tools through @playwright/mcp |
| `@anotherharness/ah-experimental-browser-use-stagehand-native` | yes | Experimental Stagehand browser tools with separately configured native models |
| `@anotherharness/ah-experimental-claude-code-mods` | yes | Experimental bridge: load Claude Code mods (hooks modules) and run their hook chains on AnotherHarness extension points |
| `@anotherharness/ah-experimental-client-ui-agent-team` | no | Web Agent Teams roster, task board, and teammate navigation |
| `@anotherharness/ah-experimental-client-ui-claude-code-mods` | no | Web band above the prompt for Claude Code mods: draws each session's mod tree and sends button presses back to the bridge |
| `@anotherharness/ah-experimental-client-ui-cot-translation` | yes | Optional machine translation of expanded reasoning, preserving original Session text |
| `@anotherharness/ah-experimental-client-ui-voice-input` | no | Record speech and insert editable text into the conversation draft |
| `@anotherharness/ah-experimental-computer-use-cua-driver-mcp` | yes | Experimental computer use through an installed Cua Driver MCP executable |
| `@anotherharness/ah-experimental-computer-use-cua-driver-native` | no | Experimental computer-use provider embedding the Cua Driver native npm SDK |
| `@anotherharness/ah-experimental-inspector` | yes | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection |
| `@anotherharness/ah-experimental-ptc-runtime-python` | yes | CPython subprocess implementation of the AnotherHarness PTC execution seam |
| `@anotherharness/ah-experimental-session-inspector` | no | Experimental virtualized Session log and live Chat group/node inspectors |
| `@anotherharness/ah-experimental-speech-to-text` | yes | Experimental speech recognition with independently selectable providers |
| `@anotherharness/ah-experimental-speech-to-text-sensevoice` | yes | Local SenseVoice ONNX transcription with a managed sherpa-onnx process |
| `@anotherharness/ah-experimental-tool-agent-team` | yes | Scoped model-facing Agent Teams tools over ctx.agentTeams |
| `@anotherharness/ah-experimental-tool-worktree` | no | Model tool that creates and enters a new Git worktree |
| `@anotherharness/ah-experimental-translator` | yes | Machine translation with reusable Session results |
| `@anotherharness/ah-experimental-worktree` | yes | Creates a named Git worktree and changes the calling Session working directory |
| `@anotherharness/ah-hooks-claude-code` | yes | Bridge plugin: run a Claude Code hooks.json / settings hook config on the AnotherHarness interception seams |
| `@anotherharness/ah-hooks-codex` | yes | Bridge plugin: run a Codex hooks.json hook config on the AnotherHarness interception seams |
| `@anotherharness/ah-session-title-all-prompts-llm` | yes | All-user-messages LLM provider plugin for AnotherHarness session titles |
| `@anotherharness/ah-skill-badge` | no | Bundled ah badge skill provider for AnotherHarness |
| `@anotherharness/ah-tool-ralph` | yes | Model-facing fresh-agent Ralph loop over the workflow and subagent seams |
| `@anotherharness/ah-tool-session-query` | yes | Workspace-authorized model-facing session history search, trace, and event read tools |
| `@anotherharness/ah-tool-terminal` | yes | Six model-facing persistent PTY tools with owner isolation and generic background-job integration |
| `@anotherharness/ah-webhook` | no | Fire-and-forget webhook rule runtime that creates Workspace-backed AnotherHarness Sessions |
| `@anotherharness/ah-webhook-github` | yes | Signed GitHub HTTP webhook adapter for the AnotherHarness webhook runtime |

## extensions

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-client-ui-cordis` | no | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch |
| `@anotherharness/ah-cordis-client-runner` | no | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries |
| `@anotherharness/ah-cordis-host-runner` | yes | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages |
| `@anotherharness/ah-tool-cordis` | no | Read-only runtime API inspection for Harness plugin development |

## feedback

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-command-feedback` | no | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command |
| `@anotherharness/ah-message-feedback` | yes | Canonical Session-log ratings and notes for finalized assistant messages |

## fs

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-fs-local` | yes | Local-filesystem implementation of the AnotherHarness filesystem seam (ctx.fs) |
| `@anotherharness/ah-fs-observation-policy` | no | File-context policy plugin for the AnotherHarness — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API) |
| `@anotherharness/ah-fs-sandbox` | yes | Sandbox-enforcing implementation of the AnotherHarness filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through |
| `@anotherharness/ah-tool-fs` | yes | Model-facing filesystem tools (read, write, edit) over the AnotherHarness filesystem seam (ctx.fs) |
| `@anotherharness/ah-tool-fs-search` | yes | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep) |
| `@anotherharness/ah-tool-str-replace-editor` | yes | Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service |

## goal

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-command-goal` | no | Human-facing slash command for persisted same-session goals |
| `@anotherharness/ah-goal` | yes | Event-sourced same-session goal state and lifecycle service for the AnotherHarness |
| `@anotherharness/ah-goal-round-driver` | no | Race-fenced same-session goal-round driver |
| `@anotherharness/ah-tool-goal` | yes | Model-facing same-session goal tools with execution-time authority checks |

## guard

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-repeat-tool-reminder` | yes | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls |
| `@anotherharness/ah-tool-call-timeout-policy` | no | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins |

## host

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-host-directory-picker-auto` | no | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the AnotherHarness web GUI host |
| `@anotherharness/ah-host-directory-picker-browse` | yes | In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem) |
| `@anotherharness/ah-host-directory-picker-native` | no | Native-OS-chooser backend of the directory-picker seam for the AnotherHarness web GUI host |
| `@anotherharness/ah-host-frontend-static` | yes | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| `@anotherharness/ah-host-open-in-app` | yes | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes |
| `@anotherharness/ah-host-plugin-inventory` | no | Read-only Remote projection of current Cordis Loader plugin state |
| `@anotherharness/ah-host-product-telemetry-otel` | yes | Explicit product usage events exported through OpenTelemetry HTTP logs |
| `@anotherharness/ah-host-webserver` | yes | Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts |

## interaction

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-commands` | no | Plugin-owned human command registry for AnotherHarness UIs |
| `@anotherharness/ah-permission-presets` | yes | User-facing permission presets (ctx.permissionPresets) for the AnotherHarness: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events |
| `@anotherharness/ah-tool-ask-user` | yes | Model-facing ask_user_question tool over the ctx.userQuestions seam |
| `@anotherharness/ah-user-approval` | yes | User-approval seam (ctx.approval) for the AnotherHarness: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default |
| `@anotherharness/ah-user-questions` | no | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs |

## jobs

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-jobs-local` | yes | Process-local implementation of the AnotherHarness background job registry seam |
| `@anotherharness/ah-tool-jobs` | yes | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry |

## llm

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-deepseek-llm-api-extensions` | no | Additive request-field registry for the official DeepSeek LLM API adapter |
| `@anotherharness/ah-llm` | no | Provider-neutral LLM service interface for the AnotherHarness |
| `@anotherharness/ah-llm-deepseek-account` | yes | DeepSeek account provider authentication and discovery |
| `@anotherharness/ah-llm-deepseek-api-key` | yes | DeepSeek api-key provider authentication and discovery |
| `@anotherharness/ah-llm-pi-ai` | yes | pi-ai-backed DeepSeek adapter for the AnotherHarness LLM seam (design-verification twin of ah-llm-deepseek) |
| `@anotherharness/ah-llm-retry` | yes | Provider-routed LLM request retry policy for the AnotherHarness |
| `@anotherharness/ah-llm-vision-bridge` | yes | Image descriptions from an image-capable model route for text-only models |
| `@anotherharness/ah-plugin-package-inventory-deepseek` | yes | Active Loader-backed plugin package inventory for official DeepSeek LLM API requests |
| `@anotherharness/ah-token-meter` | yes | Replay-aware token measurement service (ctx.tokenMeter) for the AnotherHarness |

## lsp

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-lsp` | no | Abstract LSP capability seam (ctx.lsp) for the AnotherHarness — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy |
| `@anotherharness/ah-lsp-stdio` | yes | Generic stdio language-server provider for the AnotherHarness LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace |
| `@anotherharness/ah-tool-lsp` | yes | Model-facing lsp tool over the AnotherHarness LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization |

## mcp

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-mcp-client` | yes | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools |
| `@anotherharness/ah-mcp-resources` | no | Scoped MCP resource discovery and reading through shared model tools |

## plan

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-plan-mode` | yes | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit |

## preset

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-agent-preset` | yes | Declare an Agent capability composition in Cordis YAML |
| `@anotherharness/ah-agent-preset-registry` | yes | Declarative Agent preset registry and profile-backed editing |
| `@anotherharness/ah-persona` | yes | Composition-authored deployment persona section for the AnotherHarness |

## ptc-runtime

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-ptc-runtime-node` | yes | Sandboxed Node process implementation of the AnotherHarness PTC execution capability |

## sandbox

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-sandbox-local` | yes | Local process-sandbox backends for the AnotherHarness sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed |
| `@anotherharness/ah-sandbox-policy` | yes | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |

## schedule

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-schedule` | yes | Host-wide durable reminders with shared management and original-Session delivery |
| `@anotherharness/ah-tool-schedule` | no | Model-facing reminder management tools (schedule_create, schedule_list, schedule_update, schedule_delete) over the Host ctx.schedule service |

## sdk

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-sdk-jsonrpc-server` | yes | Stdio JSON-RPC server plugin for out-of-process AnotherHarness SDK clients |

## session

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-session-checkpoint-policy` | no | Semantic session durability checkpoints before model requests and tool side effects |
| `@anotherharness/ah-session-log-deepseek` | yes | Incremental lossless session-log request extension for the official DeepSeek LLM API |
| `@anotherharness/ah-session-persistence-jsonl` | yes | JSONL durable session persistence backend for the AnotherHarness |
| `@anotherharness/ah-session-projection` | no | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
| `@anotherharness/ah-session-projection-cache` | yes | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read |
| `@anotherharness/ah-session-stats` | no | Whole-log conversation counts and wall times projection (sessionStats) for the AnotherHarness |
| `@anotherharness/ah-session-telemetry-otel` | yes | Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests |
| `@anotherharness/ah-session-title` | yes | Log-backed session title service and provider registry for the AnotherHarness |
| `@anotherharness/ah-session-title-first-prompt-llm` | yes | First-message LLM provider plugin for AnotherHarness session titles |
| `@anotherharness/ah-session-turn-outline` | no | Whole-log turn outline projection (turnOutline) for the AnotherHarness |
| `@anotherharness/ah-tool-working-directory` | no | Read and change the active Session working directory |
| `@anotherharness/ah-working-directory` | yes | Session working directories with durable changes and model context |

## session-query

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-session-log-export` | yes | Web Session-log export command and shared download dialog |
| `@anotherharness/ah-session-query-sqlite` | yes | Concrete ctx.sessionQuery backend with SQLite FTS5 search |

## settings

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-settings` | no | Abstract user-settings seam (ctx.settings) for the AnotherHarness |

## shell

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-bash-local` | yes | Local-subprocess implementation of the AnotherHarness bash executor seam |
| `@anotherharness/ah-bash-sandbox` | yes | Sandbox-consuming implementation of the AnotherHarness bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@anotherharness/ah-pwsh-local` | yes | Local PowerShell implementation of the AnotherHarness bash executor seam |
| `@anotherharness/ah-pwsh-sandbox` | yes | Sandbox-consuming implementation of the AnotherHarness PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@anotherharness/ah-shell-env` | yes | Tool-independent managed AH_* shell environment registry |
| `@anotherharness/ah-tool-bash` | yes | Model-facing bash tool with optional generic background-job and sandbox-escalation support |
| `@anotherharness/ah-tool-bash-persistent` | yes | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service |
| `@anotherharness/ah-tool-pwsh` | yes | Model-facing pwsh tool over the bash executor seam |
| `@anotherharness/ah-tool-pwsh-persistent` | yes | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service |

## skill

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-skill` | yes | Agent skill provider registry for the AnotherHarness |
| `@anotherharness/ah-skill-filesystem` | yes | Local filesystem skill provider for the AnotherHarness |
| `@anotherharness/ah-skill-office` | yes | Bundled Word, PowerPoint, and Excel workflows and structural checks |
| `@anotherharness/ah-tool-skill` | yes | Model-facing skill loading tool for the AnotherHarness |
| `@anotherharness/ah-tool-workspace-dependencies` | yes | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload |

## spill

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-spill-local` | yes | Local-filesystem implementation of the AnotherHarness spill storage seam (private session-scoped files) |
| `@anotherharness/ah-spill-policy` | yes | Token-budgeted tool-result retention with recoverable text and image paths |

## ssh

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-fs-ssh` | no | Filesystem provider over the shared POSIX SSH helper |
| `@anotherharness/ah-sandbox-ssh` | no | Remote POSIX sandbox argv provider over the shared SSH helper |
| `@anotherharness/ah-ssh` | yes | Shared OpenSSH connection and versioned POSIX remote helper |
| `@anotherharness/ah-subprocess-ssh` | no | Subprocess and terminal provider over the shared POSIX SSH helper |

## storage

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-storage` | no | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the AnotherHarness |
| `@anotherharness/ah-storage-domain` | yes | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the AnotherHarness |
| `@anotherharness/ah-storage-json` | yes | JSON file KV storage backend for the AnotherHarness storage hub |
| `@anotherharness/ah-storage-sqlite` | yes | SQLite storage backend (kv facet) for the AnotherHarness storage hub |

## subagent

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-subagent` | yes | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents |
| `@anotherharness/ah-subagent-acp` | yes | Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol |
| `@anotherharness/ah-subagent-ah-sdk` | yes | Out-of-process SDK subagent backend: drives a child AnotherHarness runtime subprocess over stdio JSON-RPC through the TypeScript SDK client |
| `@anotherharness/ah-subagent-claude-code` | yes | One-shot Claude Code subagent provider over the official Agent SDK |
| `@anotherharness/ah-subagent-codex` | yes | One-shot Codex subagent provider over the official app-server protocol |
| `@anotherharness/ah-subagent-fork-in-process` | yes | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log |
| `@anotherharness/ah-subagent-spawn-in-process` | yes | In-process spawn subagent backend: runs a fresh child agent on ctx.agents |
| `@anotherharness/ah-tool-subagent` | yes | Model-facing subagent delegation tool over the ctx.subagents seam |
| `@anotherharness/ah-tool-subagent-control` | no | Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations |

## subprocess

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-subprocess-local` | no | Local-subprocess implementation of the AnotherHarness subprocess seam |

## telemetry

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-otel` | no | Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels |

## terminal

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-terminal` | no | Persistent PTY session seam for the AnotherHarness — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup |
| `@anotherharness/ah-terminal-bash` | yes | Persistent shell PTY backend over the AnotherHarness subprocess terminal primitive |

## test-support

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-llm-replay` | yes | Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests) |

## todo

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-tool-todo` | yes | Model-facing todo_write tool over the AnotherHarness event-sourced session log |

## typert

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-typert-loader` | yes | Loader integration for generated Typert package contributions |

## web

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-tool-web` | yes | Model-facing web tools (web_search, web_fetch) over the AnotherHarness web capability seam (ctx.web) |
| `@anotherharness/ah-web` | yes | Abstract web access capability seam (ctx.web) for the AnotherHarness — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy |
| `@anotherharness/ah-web-fetch-http` | yes | Anonymous public HTTP(S) fetch provider for the AnotherHarness web capability seam (ctx.web) |
| `@anotherharness/ah-web-search-deepseek` | yes | DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the AnotherHarness web capability seam (ctx.web) |
| `@anotherharness/ah-web-search-exa` | yes | Exa-backed search provider for the AnotherHarness web capability seam (ctx.web) |
| `@anotherharness/ah-web-search-perplexity` | yes | Perplexity-backed search provider for the AnotherHarness web capability seam (ctx.web) |

## workflow

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-tool-workflow` | yes | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine |
| `@anotherharness/ah-workflow-ptc` | yes | Workflow orchestration in the shared sandboxed Node PTC runtime |

## workspace

| Package | Config | Description |
|---|---|---|
| `@anotherharness/ah-workspace` | no | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the AnotherHarness |
