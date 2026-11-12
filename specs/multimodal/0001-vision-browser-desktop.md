# 0001 — Vision, browser use, and desktop use for agents

| Field | Value |
| --- | --- |
| Status | approved |
| Area | multimodal (attachment, llm, browser-use, computer-use) |
| Owner | henriqqw |
| Created | 2026-11-11 |
| Related | [attachment subsystem](../../docs/subsystems/attachment.md), [browser use](../../docs/subsystems/browser-use.md), [computer use](../../docs/subsystems/computer-use.md) |

## Problem

Agents must be able to receive images from the user and interpret them, operate a web browser, and observe and operate desktop applications and windows. The capability seams for all three exist, but out of the box only part of it works:

- **Images.** Durable image attachments are on by default (`ah-attachment-local`, `ah-client-ui-attachment`, `ah-compaction-image-offload`). Only `deepseek-flash` (DeepSeek-V4.1-Flash) declares `inputModalities: ['text', 'image']`; `deepseek-v4-pro` is text-only, and the session controller rejects image input for it. A user on V4-Pro cannot use images at all.
- **Browser use.** `ah-browser-use` only registers one provider; every provider (Playwright MCP, Chrome DevTools MCP, Stagehand) is an `experimental` package that no shipped profile mounts. No Chromium is provisioned. The Web/Desktop right-sidebar browser is a human-facing panel, not an agent tool.
- **Desktop use.** `ah-computer-use` only registers one provider; both Cua Driver providers are `experimental` and unmounted. Under WSL the host sees the WSLg Linux desktop, not Windows applications.

## Goals

- A user can attach an image with any selected DeepSeek model and the agent answers about its content.
- A user can enable browser use with one documented setting; the agent can open, read, and operate web pages and receive screenshots.
- A user can enable desktop use; the agent can list windows, read their content (screenshots and accessibility text where the driver provides it), and act on them.
- Tool screenshots flow into the same durable attachment pipeline as user images.

## Non-goals

- Bundling a browser or desktop driver into the default install.
- Restoring browser login state across Sessions (the browser-use contract starts fresh state per Session).
- Video or audio input.

## User-visible behavior

- **Images:** attaching an image with an image-capable model sends it as-is. With a text-only model, the harness first asks the configured vision model to describe the image, shows that the description was used, and sends the description to the selected model.
- **Browser:** a shipped opt-in overlay (`apps/cli/config/examples/browser-use/`) mounts `ah-browser-use` with the Playwright MCP provider in headless `launch` mode, or in `attach` mode for an existing Chrome debugging endpoint; the [user guide](../../docs/user/guide/browser-and-desktop.md) gives the Chromium installation command.
- **Desktop:** a shipped opt-in overlay (`apps/cli/config/examples/desktop-use/`) mounts `ah-computer-use` with the native Cua Driver provider, whose npm optional dependencies ship macOS, Linux, and Windows binaries. The user guide states that WSL reaches only the WSLg Linux desktop and that Windows applications require running AnotherHarness natively on Windows.

## Acceptance criteria

- **AC-1** — Given `deepseek-flash` is selected, when the user attaches a PNG and asks what it shows, then the request carries the image and the answer references its content.
- **AC-2** — Given `deepseek-v4-pro` is selected and a vision model is configured, when the user attaches an image, then the logged user message carries a text part with the attachment reference and the vision model's description in place of the image, and the prompt is admitted instead of rejected.
- **AC-3** — Given no vision model is configured and a text-only model is selected, when the user attaches an image, then the input is rejected with an actionable message that names the setting to change.
- **AC-4** — Given browser use is enabled, when a new Session asks to open `https://example.com` and report the heading, then the agent uses browser tools and the result contains the page heading.
- **AC-5** — Given browser use is enabled, when a browser tool returns a screenshot and the model accepts images, then the screenshot is stored as a durable attachment and shown in history.
- **AC-6** — Given desktop use is enabled on a supported platform, when the agent lists windows, then the result names the open application windows.
- **AC-7** — Given a user reads the desktop-use guide, when they plan to control Windows applications, then the guide states that WSL reaches only the WSLg desktop and that AnotherHarness must run natively on Windows.
- **AC-8** — Given neither capability is enabled, when a Session starts, then no browser or desktop tools are offered and startup cost is unchanged.

## Contracts

- **Session log:** no new event. The description is a text part of the admitted user message, so the model-visible input is already in the log. The image remains stored as an attachment and is referenced by id and read-only path in that text part.
- **Configuration:** a new `ah-vision-bridge` package with `provider` and `model` fields naming any image-capable route of any mounted LLM adapter (DeepSeek, pi-ai providers, OpenAI-compatible gateways); the shipped base mounts it with `deepseek-flash`. Setup commands write user-layer profile patches.
- **Packaging:** promoting a provider out of `experimental` is a product decision governed by `verify-default-product-isolation`; this spec keeps providers opt-in.

## Design

- **Vision bridge** as its own package that defines `ctx.visionBridge`. Prompt admission consumes it optionally: when the selected model lacks `image` and the service is mounted, admission stores the images, asks the bridge for one description per image, and admits text parts in their place; without the service it rejects as before with an actionable message (AC-3). Images already in history from an earlier image-capable turn keep today's behavior.
- **Opt-in overlays** follow the existing `apps/cli/config/examples/` convention and the profile patch layering; they never edit shipped bundles. A dedicated `ah setup` launcher mode is deferred, because launcher modes are governed by `verify-application-entrypoints`.
- **Screenshots** already reach image-capable routes through the attachment store; AC-5 only adds coverage.

## Risks and mitigations

- Vision descriptions lose detail → show the description to the user and keep the original attachment for image-capable models in later turns.
- Extra cost and latency per image → only for text-only routes, with token accounting already present in `image-tokens.ts`.
- Desktop control is powerful → keep it opt-in, require explicit enablement per profile, and rely on the existing approval policy for tool calls.
- Experimental providers can change upstream → pin versions as the packages already do.

## Rollout

Opt-in through setup commands and Settings; documented in the user guide. No breaking change; no upgrade-guide entry.

## Decisions

Approved by the owner on 2026-11-11 with these answers:

1. The vision bridge defaults to `deepseek-flash`; its `provider` and `model` fields can name any image-capable route from any mounted adapter, including pi-ai providers and OpenAI-compatible gateways.
2. Browser use defaults to the Playwright MCP provider (headless `launch`; `attach` for an existing Chrome).
3. Windows applications require running AnotherHarness natively on Windows; under WSL, desktop use reaches only the WSLg Linux desktop and setup says so.
4. Browser and desktop use stay opt-in through setup commands; the shipped `web` profile does not change.

## Implementation plan

1. Vision bridge package, Session event, config field, tests for AC-2 and AC-3.
2. AC-1 regression test against the replay harness.
3. Browser-use overlays and Chromium installation guidance; provider check with the pinned upstream e2e (AC-4 with a model key).
4. Desktop-use overlay and platform guidance (AC-6 on a desktop session, AC-7 in the guide).
5. User guide pages (EN/ZH). Deferred: `ah setup` launcher mode and Settings toggles.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | — | ☐ |
| AC-2 | `packages/api/session-controller/tests/session-models.host.spec.ts`, `packages/api/session-controller/tests/vision.host.spec.ts`, `packages/llm/llm-vision-bridge/tests/vision-bridge.spec.ts` | ☑ |
| AC-3 | `packages/api/session-controller/tests/session-models.host.spec.ts` (text-only rejection without the bridge) | ☑ |
| AC-4 | `packages/experimental/browser-use-playwright-mcp/tests/upstream.e2e.ts` with `AH_BROWSER_EXECUTABLE`; the provider and MCP tools run, and the WSL host still needs the Chromium system libraries; the model-driven check needs a key | ☐ |
| AC-5 | — | ☐ |
| AC-6 | — | ☐ |
| AC-7 | `docs/user/guide/browser-and-desktop.md` (Desktop use) | ☑ |
| AC-8 | shipped `web` profile composition has no browser or desktop rows (`ah --profile web --dump-config`) | ☑ |
